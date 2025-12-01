import { ethers, network, waffle } from 'hardhat';
import { assert, expect } from 'chai';
import { Bridge, Pool, TestMessenger, Token } from '../typechain';
import { formatEther, parseUnits } from 'ethers/lib/utils';
import { addressToBase32, calcD, ESP, SP } from './utils';
import { abi as GasOracleABI } from '../artifacts/contracts/GasOracle.sol/GasOracle.json';
import { abi as WormholeMessengerABI } from '../artifacts/contracts/WormholeMessenger.sol/WormholeMessenger.json';
import { MockContract } from 'ethereum-waffle';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Big } from 'big.js';
import { BigNumber } from 'ethers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
const { AddressZero } = ethers.constants;

const { deployMockContract } = waffle;

const CURRENT_CHAIN_ID = 1;
const ORACLE_PRECISION = 18;

describe('Bridge', () => {
  let bridge: Bridge;
  let testMessenger: TestMessenger;
  let token: Token;
  let pool: Pool;
  let mockedGasOracle: MockContract;
  let mockedWhMessenger: MockContract;
  let alice: string;
  let bob: string;

  async function logDisbalance() {
    console.log('Bridge disbalance:');
    console.log('Token:', +(await pool.tokenBalance()) / ESP);
    console.log('vUSD: ', +(await pool.vUsdBalance()) / ESP);
  }

  async function setupContractsFixture(
    chainPrecision: number,
    tokenPrecision: number,
  ) {
    await network.provider.request({ method: 'hardhat_reset', params: [] });
    const tokenContractFactory = await ethers.getContractFactory('Token');
    const poolContractFactory = await ethers.getContractFactory('Pool');
    const bridgeContractFactory = (await ethers.getContractFactory(
      'Bridge',
    )) as any;
    const testMessengerContractFactory = (await ethers.getContractFactory(
      'TestMessenger',
    )) as any;
    alice = (await ethers.getSigners())[0].address;
    bob = (await ethers.getSigners())[1].address;

    // @ts-ignore
    mockedGasOracle = await deployMockContract(
      await ethers.getSigner(alice),
      GasOracleABI,
    );

    // @ts-ignore
    mockedWhMessenger = await deployMockContract(
      await ethers.getSigner(alice),
      WormholeMessengerABI,
    );

    await mockedWhMessenger.mock.receivedMessages.returns(BigNumber.from(0));

    const costOfFinalizingTransfer = 10000;
    await mockedGasOracle.mock.getTransactionGasCostInNativeToken.returns(
      costOfFinalizingTransfer,
    );

    testMessenger = await testMessengerContractFactory.deploy();
    bridge = await bridgeContractFactory.deploy(
      CURRENT_CHAIN_ID,
      chainPrecision,
      testMessenger.address,
      mockedWhMessenger.address,
      mockedGasOracle.address,
    );

    await bridge.setGasUsage(2, '1000');
    await bridge.registerBridge(2, addressToBase32(bridge.address));
    await bridge.registerBridge(1, addressToBase32(bridge.address));

    token = (await tokenContractFactory.deploy(
      'A',
      'A',
      parseUnits('100000000000000000000', tokenPrecision),
      tokenPrecision,
    )) as any;

    await bridge.addBridgeToken(2, addressToBase32(token.address));

    pool = (await poolContractFactory.deploy(
      bridge.address,
      20,
      token.address,
      0,
      1,
      'LP',
      'LP',
    )) as any;
    await bridge.addPool(pool.address, addressToBase32(token.address));
    await token.approve(
      bridge.address,
      parseUnits('100000000000000000000', tokenPrecision),
    );
    await token.approve(
      pool.address,
      parseUnits('100000000000000000000', tokenPrecision),
    );
    await pool.deposit(parseUnits('2000000000', tokenPrecision));
  }

  const testArguments = [
    {
      chainPrecision: 18,
      tokenPrecision: 18,
    },
    {
      chainPrecision: 6,
      tokenPrecision: 6,
    },
  ];
  for (const args of testArguments) {
    describe(`when chain precision: ${args.chainPrecision}; token precision: ${args.tokenPrecision}`, () => {
      const chainPrecision = args.chainPrecision;
      const tokenPrecision = args.tokenPrecision;

      async function setupContractsFixtureWithGivenPrecision() {
        await setupContractsFixture(chainPrecision, tokenPrecision);
      }

      beforeEach(async () => {
        await loadFixture(setupContractsFixtureWithGivenPrecision);
        assert(
          +(await token.decimals()) === tokenPrecision,
          'Invalid test configuration: unexpected token precision',
        );
      });

      it('check calc D', async () => {
        const expectedD = await pool.d();

        const x = await pool.tokenBalance();
        const y = await pool.vUsdBalance();
        const a = await pool.a();

        const calculatedD = calcD(x, y, a);
        expect(+expectedD).eq(calculatedD);
      });

      describe('swapAndBridge', () => {
        it('Success: D should stay the same as it was before swap', async () => {
          const expectedD = await pool.d();

          const recipient = addressToBase32(alice);
          const destinationChainId = 2;
          const nonce = 1;
          const messenger = 1;
          const amount = parseUnits('1000000000', tokenPrecision);

          const response = await bridge.swapAndBridge(
            addressToBase32(token.address),
            amount,
            recipient,
            destinationChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: '11000' },
          );

          await expect(response)
            .emit(bridge, 'ReceiveFee')
            .withArgs(10000, 1000);

          {
            const x = await pool.tokenBalance();
            const y = await pool.vUsdBalance();
            const a = await pool.a();

            const calculatedD = calcD(x, y, a);

            // expectedD   = 2000000000001
            // calculatedD = 2000000000003
            expect(expectedD).closeTo(calculatedD, 2);
          }
        });

        it('check send near-zero amount', async () => {
          const amount = parseUnits('0.03', tokenPrecision);
          const recipient = addressToBase32(alice);

          const destinationChainId = 2;
          const nonce = '2';
          const messenger = 1;

          const response = await bridge.swapAndBridge(
            addressToBase32(token.address),
            amount,
            recipient,
            destinationChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: '11000' },
          );

          const responseWithLogs = await response.wait();
          const amountToSend = responseWithLogs.events?.find(
            (ev) => ev.event === 'TokensSent',
          )?.args?.amount;
          expect(+amountToSend / ESP)
            .gte(0)
            .lte(0.03);
        });

        it('Failure: not enough fee', async () => {
          const amount = parseUnits('1000', tokenPrecision);
          const recipient = addressToBase32(alice);

          const destinationChainId = 2;
          const nonce = '1';
          const messenger = 1;

          const response = bridge.swapAndBridge(
            addressToBase32(token.address),
            amount,
            recipient,
            destinationChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: '5000' },
          );

          await expect(response).revertedWith('Bridge: not enough fee');
        });

        it('check send near-zero amount unbalanced pool (more tokens)', async () => {
          const amount = '1';
          const recipient = addressToBase32(alice);

          const destinationChainId = 2;
          const nonce = '2';
          const messenger = 1;

          // given an unbalanced pool (more tokens)
          await bridge.swapAndBridge(
            addressToBase32(token.address),
            parseUnits('1000000000', tokenPrecision),
            recipient,
            destinationChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: '11000' },
          );

          await logDisbalance();

          const response = await bridge.swapAndBridge(
            addressToBase32(token.address),
            amount,
            recipient,
            destinationChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: '11000' },
          );

          const responseWithLogs = await response.wait();
          const amountToSend = responseWithLogs.events?.find(
            (ev) => ev.event === 'TokensSent',
          )?.args?.amount;
          expect(+amountToSend).eq(0);
        });

        it('check send near-zero amount unbalanced pool (more vUsd)', async () => {
          const amount = parseUnits('0.01', tokenPrecision);
          const recipient = addressToBase32(alice);

          const destinationChainId = 2;
          const sourceChainId = 2;
          const nonce = '2';
          const messenger = 1;

          // given an unbalanced pool (more vUsd)
          await testMessenger.setIsHasMessage(true);
          await bridge.receiveTokens(
            parseUnits('1000000000', SP),
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );

          await logDisbalance();

          const response = await bridge.swapAndBridge(
            addressToBase32(token.address),
            amount,
            recipient,
            destinationChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: '11000' },
          );

          const responseWithLogs = await response.wait();
          const amountToSend = responseWithLogs.events?.find(
            (ev) => ev.event === 'TokensSent',
          )?.args?.amount;
          expect(+amountToSend / ESP)
            .gte(0)
            .lte(0.03);
        });

        it('check send', async () => {
          const amount = parseUnits('1000', tokenPrecision);
          const recipient = addressToBase32(alice);

          const destinationChainId = 2;
          const nonce = '1';
          const messenger = 1;

          const response = await bridge.swapAndBridge(
            addressToBase32(token.address),
            amount,
            recipient,
            destinationChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: '11000' },
          );
          await ethers.provider.getBalance(bridge.address);
          expect(await ethers.provider.getBalance(bridge.address)).equal(
            '10000',
          );
          expect(await ethers.provider.getBalance(testMessenger.address)).equal(
            '1000',
          );
          const responseWithLogs = await response.wait();
          const amountToSend = responseWithLogs.events?.find(
            (ev) => ev.event === 'TokensSent',
          )?.args?.amount;
          await expect(response)
            .emit(bridge, 'TokensSent')
            .withArgs(
              amountToSend,
              recipient.toLowerCase(),
              destinationChainId,
              addressToBase32(token.address),
              nonce,
              messenger,
            );
          await expect(response).emit(testMessenger, 'Sent');
        });

        it('Failure: send second time', async () => {
          const amount = '10';
          const recipient = addressToBase32(alice);

          const destinationChainId = 2;
          const nonce = '1';
          const messenger = 1;

          await (
            await bridge.swapAndBridge(
              addressToBase32(token.address),
              amount,
              recipient,
              destinationChainId,
              addressToBase32(token.address),
              nonce,
              messenger,
              0,
              { value: '15000' },
            )
          ).wait();

          await expect(
            bridge.swapAndBridge(
              addressToBase32(token.address),
              amount,
              recipient,
              destinationChainId,
              addressToBase32(token.address),
              nonce,
              messenger,
              0,
              { value: '15000' },
            ),
          ).revertedWith('Bridge: tokens already sent');
        });

        it('Failure: should revert if sending to zero-address', async () => {
          const amount = '10';
          const recipient = addressToBase32(AddressZero);

          const destinationChainId = 2;
          const nonce = '1';
          const messenger = 1;

          await expect(
            bridge.swapAndBridge(
              addressToBase32(token.address),
              amount,
              recipient,
              destinationChainId,
              addressToBase32(token.address),
              nonce,
              messenger,
              0,
              { value: '15000' },
            ),
          ).revertedWith('Bridge: bridge to the zero address');
        });

        describe('pay bridging fee with stables', () => {
          beforeEach(async () => {
            const [owner] = await ethers.getSigners();

            // given bridge has gas
            await owner.sendTransaction({
              to: bridge.address,
              value: parseUnits('10', chainPrecision),
            });
          });

          it('Success: should convert gas fee in tokens into gas fee in wei', async () => {
            const feeInUsd = Big(50);
            // price in USD / Ether
            const ethPriceInUsd = '2000';

            const amount = parseUnits('1000', tokenPrecision);
            const feeTokenAmount = parseUnits(
              feeInUsd.toString(),
              tokenPrecision,
            );
            const recipient = addressToBase32(alice);

            const destinationChainId = 2;
            const nonce = '1';
            const messenger = 1;

            await mockedGasOracle.mock.price.returns(
              parseUnits(ethPriceInUsd, ORACLE_PRECISION),
            );
            const initialBalance = await token.balanceOf(alice);
            const tx = await bridge.swapAndBridge(
              addressToBase32(token.address),
              amount,
              recipient,
              destinationChainId,
              addressToBase32(token.address),
              nonce,
              messenger,
              feeTokenAmount,
              { value: '0' },
            );
            const finalBalance = await token.balanceOf(alice);
            // should charge user with full amount, which includes gas fee
            expect(initialBalance.sub(finalBalance)).to.eq(amount);

            const feeInEth = feeInUsd.div(ethPriceInUsd);
            const expectedFeeAmount = parseUnits(
              feeInEth.toString(),
              chainPrecision,
            );

            await expect(tx)
              .to.emit(bridge, 'BridgingFeeFromTokens')
              .withArgs(expectedFeeAmount);

            // should accumulate the collected fee on the bridge contract address
            expect(await token.balanceOf(bridge.address)).to.eq(feeTokenAmount);

            // should deduct bridging gas fee in stable tokens from the initial amount
            const expectedSentAmount = amount.sub(feeTokenAmount);
            await expect(tx)
              .to.emit(pool, 'SwappedToVUsd')
              .withArgs(alice, token.address, expectedSentAmount, 949999, 0);
          });

          it('Failure: should revert when amount does not include feeTokenAmount', async () => {
            const amount = parseUnits('1', tokenPrecision);
            const feeTokenAmount = amount;

            const recipient = addressToBase32(alice);
            const destinationChainId = 2;
            const nonce = '1';
            const messenger = 1;

            await expect(
              bridge.swapAndBridge(
                addressToBase32(token.address),
                amount,
                recipient,
                destinationChainId,
                addressToBase32(token.address),
                nonce,
                messenger,
                feeTokenAmount,
                { value: '0' },
              ),
            ).to.be.revertedWith('Bridge: amount too low for fee');
          });
        });
      });

      describe('receiveTokens', () => {
        it('check receive when there is a message', async () => {
          const amount = parseUnits('1000', SP);
          const recipient = addressToBase32(alice);
          const sourceChainId = 2;
          const nonce = 1;
          const messenger = 1;
          const amountBefore = await token.balanceOf(alice);

          await testMessenger.setIsHasMessage(true);
          const response = await bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );

          const hash = '0x02013545a39f227b92c344868aaa8b45067f36bee66c893454e5020d3edfd870';

          await expect(response)
            .emit(bridge, 'TokensReceived')
            .withArgs(
              parseUnits('999.999', tokenPrecision),
              recipient,
              nonce,
              messenger,
              hash,
            );
          const amountAfter = await token.balanceOf(alice);
          await expect(amountAfter).gt(amountBefore);
        });

        it('check receive zero amount', async () => {
          const amount = '0';
          const recipient = addressToBase32(alice);
          const sourceChainId = 2;
          const nonce = 1;
          const messenger = 1;
          const amountBefore = await token.balanceOf(alice);

          await testMessenger.setIsHasMessage(true);
          await bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );
          const amountAfter = await token.balanceOf(alice);
          const received = amountAfter.sub(amountBefore);
          await expect(received).eq('0');
        });

        it('check receive near-zero amount unbalanced pool (more vUsd)', async () => {
          const amount = '1';
          const recipient = addressToBase32(alice);
          const sourceChainId = 2;
          const nonce = 1;
          const messenger = 1;

          await testMessenger.setIsHasMessage(true);
          await bridge.receiveTokens(
            parseUnits('1000000000', SP),
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );
          await logDisbalance();

          const amountBefore = await token.balanceOf(alice);
          await bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );
          const amountAfter = await token.balanceOf(alice);
          const received = amountAfter.sub(amountBefore);
          await expect(received).lte(parseUnits('0.03', tokenPrecision));
        });

        it('check receive near-zero amount unbalanced pool (more tokens)', async () => {
          const amount = '1';
          const recipient = addressToBase32(alice);
          const sourceChainId = 2;
          const destinationChainId = 2;
          const nonce = 1;
          const messenger = 1;

          // given an unbalanced pool (more tokens)
          await bridge.swapAndBridge(
            addressToBase32(token.address),
            parseUnits('1000000000', tokenPrecision),
            recipient,
            destinationChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: '11000' },
          );
          await logDisbalance();

          const amountBefore = await token.balanceOf(alice);
          await testMessenger.setIsHasMessage(true);
          await bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );
          const amountAfter = await token.balanceOf(alice);
          const received = amountAfter.sub(amountBefore);
          await expect(received).lte(parseUnits('0.03', tokenPrecision));
        });

        it('check already received message', async () => {
          const amount = parseUnits('1000', SP);
          const recipient = addressToBase32(alice);
          const sourceChainId = 2;
          const nonce = 1;
          const messenger = 1;

          await testMessenger.setIsHasMessage(true);
          await bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );

          const errorTx = bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );

          await expect(errorTx).revertedWith('Bridge: message processed');
        });

        it('Failure: bridge not registered', async () => {
          const amount = parseUnits('1000', tokenPrecision);
          const recipient = addressToBase32(alice);
          const sourceChainId = 3;
          const nonce = 1;
          const messenger = 1;

          await testMessenger.setIsHasMessage(true);
          const errorTx = bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );

          await expect(errorTx).revertedWith('Bridge: source not registered');
        });

        it('check receive when there is no message', async () => {
          const amount = parseUnits('1000', tokenPrecision);
          const recipient = addressToBase32(alice);

          const sourceChainId = 2;
          const nonce = 1;
          const messenger = 1;

          await testMessenger.setIsHasMessage(false);
          const tx = bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
          );
          await expect(tx).revertedWith('Bridge: no message');
        });

        it('Success: should pass extra gas to recipient', async () => {
          const extraGas = '1000';
          const amount = parseUnits('1000', SP);
          const recipient = addressToBase32(bob);
          const recipientSigner = await ethers.getSigner(bob);
          const sourceChainId = 2;
          const nonce = 1;
          const messenger = 1;

          await testMessenger.setIsHasMessage(true);

          await expect(() =>
            bridge.receiveTokens(
              amount,
              recipient,
              sourceChainId,
              addressToBase32(token.address),
              nonce,
              messenger,
              0,
              { value: extraGas },
            ),
          ).to.changeEtherBalance(recipientSigner, extraGas);
        });

        it('Failure: should be OK when passing extra gas fails', async () => {
          const invalidGasRecipient = token.address;
          const initialBalance = await ethers.provider.getBalance(
            invalidGasRecipient,
          );
          const extraGas = '1000';
          const amount = parseUnits('1000', SP);
          const recipient = addressToBase32(invalidGasRecipient);
          const sourceChainId = 2;
          const nonce = 1;
          const messenger = 1;

          await testMessenger.setIsHasMessage(true);

          await bridge.receiveTokens(
            amount,
            recipient,
            sourceChainId,
            addressToBase32(token.address),
            nonce,
            messenger,
            0,
            { value: extraGas },
          );
          const actualBalance = await ethers.provider.getBalance(
            invalidGasRecipient,
          );
          expect(actualBalance).to.equal(initialBalance);
        });

        it('Failure: should revert transaction if received less tokens than required', async () => {
          const tokens = '1000';
          const amountSP = parseUnits(tokens, SP);
          const amount = parseUnits(tokens, tokenPrecision);
          const recipient = addressToBase32(alice);
          const sourceChainId = 2;
          const nonce = 1;
          const messenger = 1;
          const amountBefore = await token.balanceOf(alice);

          await testMessenger.setIsHasMessage(true);
          await expect(
            bridge.receiveTokens(
              amountSP,
              recipient,
              sourceChainId,
              addressToBase32(token.address),
              nonce,
              messenger,
              amount.add(1),
            ),
          ).to.be.revertedWith('Pool: slippage');

          const amountAfter = await token.balanceOf(alice);
          // balance should not change
          await expect(amountAfter).eq(amountBefore);
        });
      });

      describe('withdrawGasTokens', () => {
        it('Success: should withdraw gas', async () => {
          const amount = '123456789123456789';
          await (
            await ethers.getSigner(alice)
          ).sendTransaction({
            to: bridge.address,
            value: amount,
          });
          await expect(
            await bridge.withdrawGasTokens(amount),
          ).changeEtherBalances(
            [await ethers.getSigner(alice), bridge],
            [amount, '-' + amount],
          );
        });

        it('Failure: should revert when the caller is not the owner', async () => {
          await expect(
            bridge
              .connect((await ethers.getSigners())[1])
              .withdrawGasTokens('1'),
          ).revertedWith('Ownable: caller is not the owner');
        });
      });

      describe('getBridgingCostInTokens', () => {
        it('Success: should return token value of bridging cost with token decimals', async () => {
          const destinationChainId = 2;
          const messenger = 2;
          // price in USD / Ether
          const ethPriceInUsd = '2000';
          const messagingGasAmount = '50000';
          const destinationGasPrice = parseUnits('250', 'gwei');
          const messagingCost = destinationGasPrice.mul(messagingGasAmount);
          const receiveTxGasAmount = '40000';
          const receiveTxCost = destinationGasPrice.mul(receiveTxGasAmount);
          await bridge.setGasUsage(destinationChainId, receiveTxGasAmount);

          const totalBridgingCost = receiveTxCost.add(messagingCost);
          const totalBridgingCostInEth = formatEther(
            totalBridgingCost.toString(),
          );
          const bridgingPriceInUsd = Big(totalBridgingCostInEth).mul(
            ethPriceInUsd,
          );

          await mockedWhMessenger.mock.gasUsage
            .withArgs(destinationChainId)
            .returns(messagingGasAmount);
          const totalGasAmount = Big(messagingGasAmount)
            .add(receiveTxGasAmount)
            .toFixed(0, 0);
          await mockedGasOracle.mock.getTransactionGasCostInUSD
            .withArgs(destinationChainId, totalGasAmount)
            .returns(
              parseUnits(bridgingPriceInUsd.toString(), ORACLE_PRECISION),
            );
          await mockedGasOracle.mock.getTransactionGasCostInUSD.revertsWithReason(
            'Unexpected getTransactionGasCostInUSD arguments',
          );

          const actual = await bridge.getBridgingCostInTokens(
            destinationChainId,
            messenger,
            token.address,
          );

          const tokenDecimals = await token.decimals();
          const expected = parseUnits(
            bridgingPriceInUsd.toString(),
            tokenDecimals,
          );
          expect(actual.toString()).to.equal(expected.toString());
        });
      });

      describe('Admin methods', () => {
        let owner: SignerWithAddress;
        let user: SignerWithAddress;

        beforeEach(async () => {
          [owner, user] = await ethers.getSigners();
        });

        describe('setRebalancer', async () => {
          it('Success: should set the balancer', async () => {
            await bridge.setRebalancer(bob);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridge.connect(await ethers.getSigner(bob)).setRebalancer(bob),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('setStopAuthority', async () => {
          it('Success: should update stopAuthority', async () => {
            await bridge.setRebalancer(bob);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(bridge.connect(user).setRebalancer(bob)).revertedWith(
              'Ownable: caller is not the owner',
            );
          });
        });

        describe('startSwap', () => {
          it('Success: should start swap', async () => {
            await bridge.startSwap();

            expect(await bridge.canSwap()).eq(1);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(bridge.connect(user).startSwap()).revertedWith(
              'Ownable: caller is not the owner',
            );
          });
        });

        describe('stopSwap', () => {
          it('Success: should stop swap', async () => {
            // given user is the stopAuthority
            await bridge.setStopAuthority(user.address);

            await bridge.connect(user).stopSwap();

            expect(await bridge.canSwap()).eq(0);
          });

          it('Failure: should revert when the is not stopAuthority', async () => {
            await expect(bridge.connect(user).stopSwap()).revertedWith(
              'Router: is not stopAuthority',
            );
          });
        });

        describe('when swap is stopped', () => {
          beforeEach(async () => {
            await bridge.stopSwap();
          });

          it('Failure: swapAndBridge should revert', async () => {
            const recipient = addressToBase32(alice);
            const destinationChainId = 2;
            const nonce = 1;
            const messenger = 1;
            const amount = parseUnits('1000000000', tokenPrecision);

            await expect(
              bridge.swapAndBridge(
                addressToBase32(token.address),
                amount,
                recipient,
                destinationChainId,
                addressToBase32(token.address),
                nonce,
                messenger,
                0,
                { value: '11000' },
              ),
            ).revertedWith('Router: swap prohibited');
          });

          it('Failure: receiveTokens should revert', async () => {
            const amount = '1';
            const recipient = addressToBase32(alice);
            const sourceChainId = 2;
            const nonce = 1;
            const messenger = 1;

            await testMessenger.setIsHasMessage(true);
            await expect(
              bridge.receiveTokens(
                amount,
                recipient,
                sourceChainId,
                addressToBase32(token.address),
                nonce,
                messenger,
                0,
              ),
            ).revertedWith('Router: swap prohibited');
          });

          it('Failure: receiveTokens should revert', async () => {
            await testMessenger.setIsHasMessage(true);
            await expect(
              bridge.swap(
                parseUnits('1', tokenPrecision),
                addressToBase32(token.address),
                addressToBase32(token.address),
                bob,
                0,
              ),
            ).revertedWith('Router: swap prohibited');
          });
        });

        describe('withdrawBridgingFeeInTokens', async () => {
          let feeTokenAmount = BigNumber.from(0);

          beforeEach(async () => {
            // given bridge has gas
            await owner.sendTransaction({
              to: bridge.address,
              value: parseUnits('10', chainPrecision),
            });

            // given the bridge has accumulated some bridging fee in tokens
            const feeTokens = Big(50);
            // price in USD / Ether
            const gasPrice = Big(2000);

            const tokenDecimals = await token.decimals();
            const amount = parseUnits('1000', tokenDecimals);
            feeTokenAmount = parseUnits(feeTokens.toString(), tokenDecimals);
            const recipient = addressToBase32(alice);

            const destinationChainId = 2;
            const nonce = '1';
            const messenger = 1;

            await mockedGasOracle.mock.price.returns(
              parseUnits(gasPrice.toString(), ORACLE_PRECISION),
            );
            await bridge.swapAndBridge(
              addressToBase32(token.address),
              amount,
              recipient,
              destinationChainId,
              addressToBase32(token.address),
              nonce,
              messenger,
              feeTokenAmount,
              { value: '0' },
            );
          });

          it('Success: should transfer accumulated fee to the owner', async () => {
            await expect(() =>
              bridge.withdrawBridgingFeeInTokens(token.address),
            ).to.changeTokenBalance(token, owner, feeTokenAmount);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridge.connect(user).withdrawBridgingFeeInTokens(token.address),
            ).to.be.revertedWith('Ownable: caller is not the owner');
          });
        });
      });
    });
  }
});
