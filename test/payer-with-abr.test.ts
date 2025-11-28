import { ethers } from 'hardhat';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  PayerWithAbr,
  MockBridge,
  MockCctpBridge,
  MockOftBridge,
  Token,
} from '../typechain';
import { parseUnits } from 'ethers/lib/utils';
import { addressToBytes32 } from '../scripts/helper';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

const CHAIN_2 = 2;
const EXCHANGE_RATE_PRECISION = 18;
const ALLBRIDGE_MESSENGER = 1;
const CCTP_MESSENGER = 3;
const OFT_MESSENGER = 5;

describe('PayerWithAbr', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  const coder = ethers.utils.defaultAbiCoder;

  let token: Token;
  let abrToken: Token;
  let payer: PayerWithAbr;
  let bridge: MockBridge;
  let cctpBridge: MockCctpBridge;
  let oftBridge: MockOftBridge;

  let bridgeSwapAndBridgeInputTypes: string[];
  let cctpBridgeInputTypes: string[];
  let oftBridgeInputTypes: string[];

  async function setupContractsFixture(
    chainPrecision: number,
    tokenPrecision: number,
    abrTokenPrecision: number,
  ) {
    const tokenContractFactory = await ethers.getContractFactory('Token');
    const contractFactory = (await ethers.getContractFactory(
      'PayerWithAbr',
    )) as any;
    const mockBridgeFactory = await ethers.getContractFactory('MockBridge');
    const mockCctpBridgeFactory = await ethers.getContractFactory(
      'MockCctpBridge',
    );
    const mockOftBridgeFactory = await ethers.getContractFactory(
      'MockOftBridge',
    );

    [owner, alice] = await ethers.getSigners();

    bridge = await mockBridgeFactory.deploy();
    cctpBridge = await mockCctpBridgeFactory.deploy();
    oftBridge = await mockOftBridgeFactory.deploy();

    abrToken = await tokenContractFactory.deploy(
      'ABR',
      'ABR',
      parseUnits('100000000000000000000', abrTokenPrecision),
      abrTokenPrecision,
    );

    token = (await tokenContractFactory.deploy(
      'Test Stable Token',
      'A',
      parseUnits('100000000000000000000', tokenPrecision),
      tokenPrecision,
    )) as any;

    payer = await contractFactory.deploy(abrToken.address, chainPrecision);
    console.log('Contracts deployed');

    bridgeSwapAndBridgeInputTypes = mockBridgeFactory.interface
      .getFunction('swapAndBridge')
      .inputs.map((i) => i.type);
    cctpBridgeInputTypes = mockCctpBridgeFactory.interface
      .getFunction('bridge')
      .inputs.map((i) => i.type);
    oftBridgeInputTypes = mockOftBridgeFactory.interface
      .getFunction('bridge')
      .inputs.map((i) => i.type);

    await abrToken.transfer(
      alice.address,
      parseUnits('1000', abrTokenPrecision),
    );
    await abrToken
      .connect(alice)
      .approve(payer.address, ethers.constants.MaxUint256);

    await token.transfer(alice.address, parseUnits('1000', tokenPrecision));
    await token
      .connect(alice)
      .approve(bridge.address, ethers.constants.MaxUint256);
    await token
      .connect(alice)
      .approve(payer.address, ethers.constants.MaxUint256);
    console.log('Contracts set up');
  }

  const testArguments = [
    {
      chainPrecision: 18,
      tokenPrecision: 18,
      abrTokenPrecision: 9,
    },
    {
      chainPrecision: 6,
      tokenPrecision: 6,
      abrTokenPrecision: 9,
    },
  ];
  for (const args of testArguments) {
    describe(`when chain precision: ${args.chainPrecision}; token precision: ${args.tokenPrecision}; ABR precision: ${args.abrTokenPrecision}`, () => {
      const chainPrecision = args.chainPrecision;
      const tokenPrecision = args.tokenPrecision;
      const abrTokenPrecision = args.abrTokenPrecision;

      async function setupContractsFixtureWithGivenPrecision() {
        await setupContractsFixture(
          chainPrecision,
          tokenPrecision,
          abrTokenPrecision,
        );
      }

      beforeEach(async () => {
        await loadFixture(setupContractsFixtureWithGivenPrecision);
        assert(
          +(await token.decimals()) === tokenPrecision,
          'Invalid test configuration: unexpected token precision',
        );
        assert(
          +(await abrToken.decimals()) === abrTokenPrecision,
          'Invalid test configuration: unexpected ABR token precision',
        );
      });

      describe('Deployment', function () {
        it('Success: should set the initial state', async function () {
          expect(await payer.abrToken()).to.eq(abrToken.address);
        });
      });

      describe('swapAndBridge', function () {
        let receiveTxCost: bigint;
        let messageCost: bigint;

        const amount = parseUnits('100', tokenPrecision);
        const recipient = '0x40818739e51057D984B05Cbc82fee9B15A95674F';
        const destinationChainId = CHAIN_2;
        const recipientTokenAddress =
          '0xF052839B48eE462fedC250F5CEF8263DD569228b';
        const nonce = 1;
        const messengerProtocol = ALLBRIDGE_MESSENGER;
        let params: string;

        beforeEach(async function () {
          await owner.sendTransaction({
            to: payer.address,
            value: ethers.utils.parseEther('10'),
          });
          await payer.approveBridgeToken(token.address, bridge.address);
          await payer.setExchangeRate(
            parseUnits('0.5', EXCHANGE_RATE_PRECISION),
          );
          receiveTxCost = BigInt(parseUnits('1', chainPrecision).toString());
          messageCost = BigInt(parseUnits('1', chainPrecision).toString());
          await bridge.mockTransactionCost(receiveTxCost);
          await bridge.mockMessageCost(messageCost);

          await payer.registerTarget(
            ALLBRIDGE_MESSENGER,
            bridge.address,
            `swapAndBridge(${bridgeSwapAndBridgeInputTypes.join()})`,
          );
          params = coder.encode(bridgeSwapAndBridgeInputTypes, [
            addressToBytes32(token.address),
            amount,
            addressToBytes32(recipient),
            destinationChainId,
            addressToBytes32(recipientTokenAddress),
            nonce,
            messengerProtocol,
            '0',
          ]);
        });

        it('Success: should charge ABR tokens', async function () {
          const abrAmount = parseUnits('1', abrTokenPrecision);
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
            );
          expect(response).to.changeTokenBalances(
            abrToken,
            [alice, payer],
            ['-' + abrAmount.toString(), abrAmount.toString()],
          );
        });

        it('Success: should call bridge with required native tokens value', async function () {
          const expectedFeeAmount = receiveTxCost + messageCost;
          const abrAmount = await payer.nativeTokensToAbr(expectedFeeAmount);
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
            );
          await expect(response)
            .to.emit(bridge, 'SwapAndBridgeEvent')
            .withArgs(
              addressToBytes32(token.address),
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              addressToBytes32(recipientTokenAddress),
              nonce,
              messengerProtocol,
              '0',
              expectedFeeAmount,
            );
        });

        it('Success: should call bridge with native tokens from sender', async function () {
          const abrAmount = BigInt(
            parseUnits('0.5', abrTokenPrecision).toString(),
          );
          const nativeTokenAmountFromSender = BigInt(
            parseUnits('1', chainPrecision).toString(),
          );
          const expectedFeeAmount = BigInt(
            parseUnits('2', chainPrecision).toString(),
          );
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
              {
                value: nativeTokenAmountFromSender,
              },
            );
          await expect(response)
            .to.emit(bridge, 'SwapAndBridgeEvent')
            .withArgs(
              addressToBytes32(token.address),
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              addressToBytes32(recipientTokenAddress),
              nonce,
              messengerProtocol,
              '0',
              expectedFeeAmount,
            );
        });

        it('Failure: should pass error data from target', async function () {
          await bridge.mockRevertNotEnoughFee(true);

          const abrAmount = parseUnits('1', abrTokenPrecision);
          await expect(
            payer
              .connect(alice)
              .transferTokensAndCallTarget(
                token.address,
                amount,
                abrAmount,
                messengerProtocol,
                params,
              ),
          ).revertedWith('Bridge: not enough fee');
        });
      });

      describe('CCTP bridge', function () {
        let receiveTxCost: bigint;

        const amount = parseUnits('100', tokenPrecision);
        const recipient = '0x40818739e51057D984B05Cbc82fee9B15A95674F';
        const destinationChainId = CHAIN_2;
        const messengerProtocol = CCTP_MESSENGER;
        let params: string;

        beforeEach(async function () {
          await owner.sendTransaction({
            to: payer.address,
            value: ethers.utils.parseEther('10'),
          });
          await payer.approveBridgeToken(token.address, cctpBridge.address);
          await payer.setExchangeRate(
            parseUnits('0.5', EXCHANGE_RATE_PRECISION),
          );
          receiveTxCost = BigInt(parseUnits('1', chainPrecision).toString());
          await cctpBridge.mockTransactionCost(receiveTxCost);

          await payer.registerTarget(
            CCTP_MESSENGER,
            cctpBridge.address,
            `bridge(${cctpBridgeInputTypes.join()})`,
          );
          params = coder.encode(cctpBridgeInputTypes, [
            amount,
            addressToBytes32(recipient),
            destinationChainId,
            '0',
          ]);
        });

        it('Success: should charge ABR tokens', async function () {
          const abrAmount = parseUnits('1', abrTokenPrecision);
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
            );
          expect(response).to.changeTokenBalances(
            abrToken,
            [alice, payer],
            ['-' + abrAmount.toString(), abrAmount.toString()],
          );
        });

        it('Success: should call CCTP bridge with required native tokens value', async function () {
          const expectedFeeAmount = receiveTxCost;
          const abrAmount = await payer.nativeTokensToAbr(expectedFeeAmount);
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
            );
          await expect(response)
            .to.emit(cctpBridge, 'BridgeEvent')
            .withArgs(
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              '0',
              expectedFeeAmount,
            );
        });

        it('Success: should call CCTP bridge with native tokens from sender', async function () {
          const abrAmount = BigInt(
            parseUnits('0.5', abrTokenPrecision).toString(),
          );
          const nativeTokenAmountFromSender = BigInt(
            parseUnits('1', chainPrecision).toString(),
          );
          const expectedFeeAmount = BigInt(
            parseUnits('2', chainPrecision).toString(),
          );
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
              {
                value: nativeTokenAmountFromSender,
              },
            );
          await expect(response)
            .to.emit(cctpBridge, 'BridgeEvent')
            .withArgs(
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              '0',
              expectedFeeAmount,
            );
        });
      });

      describe('OFT bridge', function () {
        const amount = parseUnits('100', tokenPrecision);
        const recipient = '0x40818739e51057D984B05Cbc82fee9B15A95674F';
        const destinationChainId = CHAIN_2;
        const extraGasInDestinationToken = 0;
        const slippageBP = 50;
        const messengerProtocol = OFT_MESSENGER;
        const relayerFeeAmount = parseUnits('2', chainPrecision).toString();
        let params: string;

        beforeEach(async function () {
          await owner.sendTransaction({
            to: payer.address,
            value: ethers.utils.parseEther('10'),
          });
          await payer.approveBridgeToken(token.address, oftBridge.address);
          await payer.setExchangeRate(
            parseUnits('0.5', EXCHANGE_RATE_PRECISION),
          );
          await oftBridge.mockRelayerFee(relayerFeeAmount);

          await payer.registerTarget(
            OFT_MESSENGER,
            oftBridge.address,
            `bridge(${oftBridgeInputTypes.join()})`,
          );
          params = coder.encode(oftBridgeInputTypes, [
            token.address,
            amount,
            addressToBytes32(recipient),
            destinationChainId,
            '0',
            extraGasInDestinationToken,
            slippageBP,
          ]);
        });

        it('Success: should charge ABR tokens', async function () {
          const abrAmount = parseUnits('1', abrTokenPrecision);
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
            );
          expect(response).to.changeTokenBalances(
            abrToken,
            [alice, payer],
            ['-' + abrAmount.toString(), abrAmount.toString()],
          );
        });

        it('Success: should call OFT bridge with required native tokens value', async function () {
          const expectedFeeAmount = relayerFeeAmount;
          const abrAmount = await payer.nativeTokensToAbr(expectedFeeAmount);
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
            );
          await expect(response)
            .to.emit(oftBridge, 'BridgeEvent')
            .withArgs(
              token.address,
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              '0',
              extraGasInDestinationToken,
              slippageBP,
              expectedFeeAmount,
            );
        });

        it('Success: should call OFT bridge with native tokens from sender', async function () {
          const abrAmount = BigInt(
            parseUnits('0.5', abrTokenPrecision).toString(),
          );
          const nativeTokenAmountFromSender = BigInt(
            parseUnits('1', chainPrecision).toString(),
          );
          const expectedFeeAmount = BigInt(
            parseUnits('2', chainPrecision).toString(),
          );
          const response = await payer
            .connect(alice)
            .transferTokensAndCallTarget(
              token.address,
              amount,
              abrAmount,
              messengerProtocol,
              params,
              {
                value: nativeTokenAmountFromSender,
              },
            );
          await expect(response)
            .to.emit(oftBridge, 'BridgeEvent')
            .withArgs(
              token.address,
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              '0',
              extraGasInDestinationToken,
              slippageBP,
              expectedFeeAmount,
            );
        });
      });

      describe('Admin methods', () => {
        describe('setExchangeRate', () => {
          const rate = parseUnits('0.0001', EXCHANGE_RATE_PRECISION).toString();

          it('Success: should set exchange rate', async () => {
            await payer.setExchangeRate(rate);
            expect((await payer.exchangeRate()).toString()).to.eq(rate);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              payer.connect(alice).setExchangeRate(rate),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('registerTarget', () => {
          it('Success: should register target', async () => {
            const expectedMethodSelector = '0x4cd480bd';
            await payer.registerTarget(
              ALLBRIDGE_MESSENGER,
              bridge.address,
              `swapAndBridge(${bridgeSwapAndBridgeInputTypes.join()})`,
            );
            const targetMeta = await payer.targets(ALLBRIDGE_MESSENGER);
            expect(targetMeta[0]).to.eq(bridge.address)
            expect(targetMeta[1]).to.eq(expectedMethodSelector);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              payer.connect(alice).registerTarget(
                ALLBRIDGE_MESSENGER,
                bridge.address,
                `swapAndBridge(${bridgeSwapAndBridgeInputTypes.join()})`,
              ),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('unregisterTarget', () => {
          beforeEach(async () => {
            await payer.registerTarget(
              ALLBRIDGE_MESSENGER,
              bridge.address,
              `swapAndBridge(${bridgeSwapAndBridgeInputTypes.join()})`,
            );
          });

          it('Success: should remove target registration', async () => {
            await payer.unregisterTarget(
              ALLBRIDGE_MESSENGER,
            );
            const targetMeta = await payer.targets(ALLBRIDGE_MESSENGER);
            expect(targetMeta[0]).to.eq(ethers.constants.AddressZero)
            expect(targetMeta[1]).to.eq('0x00000000');
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              payer.connect(alice).unregisterTarget(
                ALLBRIDGE_MESSENGER,
              ),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('approveBridgeToken', () => {
          it('Success: should approve bridge', async () => {
            await payer.approveBridgeToken(token.address, bridge.address);
            expect(
              await token.allowance(payer.address, bridge.address),
            ).to.eq(ethers.constants.MaxUint256);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              payer.connect(alice).approveBridgeToken(token.address, bridge.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('withdrawGas', () => {
          const amount = '123456789123456789';
          beforeEach(async function () {
            await alice.sendTransaction({
              to: payer.address,
              value: amount,
            });
          });

          it('Success: should withdraw gas', async () => {
            await expect(
              await payer.withdrawGas(amount),
            ).changeEtherBalances([owner, payer], [amount, '-' + amount]);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              payer.connect(alice).withdrawGas(amount),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('withdrawTokens', () => {
          const amount = '123456789123456789';
          beforeEach(async function () {
            await abrToken.transfer(payer.address, amount);
          });

          it('Success: should withdraw tokens', async () => {
            await expect(() =>
              payer.withdrawTokens(abrToken.address),
            ).to.changeTokenBalances(
              abrToken,
              [payer, owner],
              ['-' + amount.toString(), amount.toString()],
            );
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              payer.connect(alice).withdrawTokens(abrToken.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });
      });
    });
  }
});
