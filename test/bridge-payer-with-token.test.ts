import { ethers } from 'hardhat';
import { assert, expect } from 'chai';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import {
  BridgePayerWithToken,
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

describe('BridgePayerWithToken', function () {
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  let token: Token;
  let abrToken: Token;
  let bridge: MockBridge;
  let cctpBridge: MockCctpBridge;
  let oftBridge: MockOftBridge;
  let bridgePayer: BridgePayerWithToken;

  async function setupContractsFixture(
    chainPrecision: number,
    tokenPrecision: number,
    abrTokenPrecision: number,
  ) {
    const tokenContractFactory = await ethers.getContractFactory('Token');
    const contractFactory = (await ethers.getContractFactory(
      'BridgePayerWithToken',
    )) as any;
    const mockBridgeFactory = (await ethers.getContractFactory(
      'MockBridge',
    )) as any;
    const mockCctpBridgeFactory = (await ethers.getContractFactory(
      'MockCctpBridge',
    )) as any;
    const mockOftBridgeFactory = (await ethers.getContractFactory(
      'MockOftBridge',
    )) as any;

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

    bridgePayer = await contractFactory.deploy(
      abrToken.address,
      chainPrecision,
      bridge.address,
    );
    console.log('Contracts deployed');

    await bridgePayer.setCctpBridge(cctpBridge.address, token.address);
    await bridgePayer.setOftBridge(oftBridge.address);

    await abrToken.transfer(
      alice.address,
      parseUnits('1000', abrTokenPrecision),
    );
    await abrToken
      .connect(alice)
      .approve(bridgePayer.address, ethers.constants.MaxUint256);

    await token.transfer(alice.address, parseUnits('1000', tokenPrecision));
    await token
      .connect(alice)
      .approve(bridge.address, ethers.constants.MaxUint256);
    await token
      .connect(alice)
      .approve(bridgePayer.address, ethers.constants.MaxUint256);
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
          expect(await bridgePayer.abrToken()).to.eq(abrToken.address);
          expect(await bridgePayer.bridge()).to.eq(bridge.address);
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
        const messengerProtocol = 1;

        beforeEach(async function () {
          await owner.sendTransaction({
            to: bridgePayer.address,
            value: ethers.utils.parseEther('10'),
          });
          await bridgePayer.approveBridgeToken(token.address);
          await bridgePayer.setExchangeRate(
            parseUnits('0.5', EXCHANGE_RATE_PRECISION),
          );
          receiveTxCost = BigInt(parseUnits('1', chainPrecision).toString());
          messageCost = BigInt(parseUnits('1', chainPrecision).toString());
          await bridge.mockTransactionCost(receiveTxCost);
          await bridge.mockMessageCost(messageCost);
        });

        it('Success: should charge ABR tokens', async function () {
          const abrAmount = parseUnits('1', abrTokenPrecision);
          const response = await bridgePayer
            .connect(alice)
            .swapAndBridge(
              addressToBytes32(token.address),
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              addressToBytes32(recipientTokenAddress),
              nonce,
              messengerProtocol,
              abrAmount,
            );
          expect(response).to.changeTokenBalances(
            abrToken,
            [alice, bridgePayer],
            ['-' + abrAmount.toString(), abrAmount.toString()],
          );
        });

        it('Success: should call bridge with required native tokens value', async function () {
          const abrAmount = await bridgePayer.getBridgeFeeInAbr(
            destinationChainId,
            messengerProtocol,
            ethers.constants.AddressZero,
            '0',
          );
          const expectedFeeAmount = receiveTxCost + messageCost;
          const response = await bridgePayer
            .connect(alice)
            .swapAndBridge(
              addressToBytes32(token.address),
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              addressToBytes32(recipientTokenAddress),
              nonce,
              messengerProtocol,
              abrAmount,
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

        it('Success: should call bridge with native tokens value for extra gas', async function () {
          const requiredAbrAmount = BigInt(
            (
              await bridgePayer.getBridgeFeeInAbr(
                destinationChainId,
                messengerProtocol,
                ethers.constants.AddressZero,
                '0',
              )
            ).toString(),
          );
          const extraAbrAmount = BigInt(
            parseUnits('1', abrTokenPrecision).toString(),
          );
          const extraNativeAmount = BigInt(
            parseUnits('2', chainPrecision).toString(),
          );
          const expectedFeeAmount =
            receiveTxCost + messageCost + extraNativeAmount;
          const response = await bridgePayer
            .connect(alice)
            .swapAndBridge(
              addressToBytes32(token.address),
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              addressToBytes32(recipientTokenAddress),
              nonce,
              messengerProtocol,
              requiredAbrAmount + extraAbrAmount,
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
          const response = await bridgePayer
            .connect(alice)
            .swapAndBridge(
              addressToBytes32(token.address),
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              addressToBytes32(recipientTokenAddress),
              nonce,
              messengerProtocol,
              abrAmount,
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

        it('Failure: should revert when not enough ABR tokens to cover the bridging fee', async function () {
          const lowAbrAmount = parseUnits('0.1', abrTokenPrecision);
          await expect(
            bridgePayer
              .connect(alice)
              .swapAndBridge(
                addressToBytes32(token.address),
                amount,
                addressToBytes32(recipient),
                destinationChainId,
                addressToBytes32(recipientTokenAddress),
                nonce,
                messengerProtocol,
                lowAbrAmount,
              ),
          ).revertedWith('Payer: not enough fee');
        });
      });

      describe('cctpBridge', function () {
        let receiveTxCost: bigint;

        const amount = parseUnits('100', tokenPrecision);
        const recipient = '0x40818739e51057D984B05Cbc82fee9B15A95674F';
        const destinationChainId = CHAIN_2;
        const messengerProtocol = 3;

        beforeEach(async function () {
          await owner.sendTransaction({
            to: bridgePayer.address,
            value: ethers.utils.parseEther('10'),
          });
          await bridgePayer.approveBridgeToken(token.address);
          await bridgePayer.setExchangeRate(
            parseUnits('0.5', EXCHANGE_RATE_PRECISION),
          );
          receiveTxCost = BigInt(parseUnits('1', chainPrecision).toString());
          await cctpBridge.mockTransactionCost(receiveTxCost);
        });

        it('Success: should charge ABR tokens', async function () {
          const abrAmount = parseUnits('1', abrTokenPrecision);
          const response = await bridgePayer
            .connect(alice)
            .bridgeCctp(
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              messengerProtocol,
              abrAmount,
            );
          expect(response).to.changeTokenBalances(
            abrToken,
            [alice, bridgePayer],
            ['-' + abrAmount.toString(), abrAmount.toString()],
          );
        });

        it('Success: should call CCTP bridge with required native tokens value', async function () {
          const abrAmount = await bridgePayer.getBridgeFeeInAbr(
            destinationChainId,
            messengerProtocol,
            ethers.constants.AddressZero,
            '0',
          );
          const expectedFeeAmount = receiveTxCost;
          const response = await bridgePayer
            .connect(alice)
            .bridgeCctp(
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              messengerProtocol,
              abrAmount,
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

        it('Success: should call CCTP bridge with native tokens value for extra gas', async function () {
          const requiredAbrAmount = BigInt(
            (
              await bridgePayer.getBridgeFeeInAbr(
                destinationChainId,
                messengerProtocol,
                ethers.constants.AddressZero,
                '0',
              )
            ).toString(),
          );
          const extraAbrAmount = BigInt(
            parseUnits('1', abrTokenPrecision).toString(),
          );
          const extraNativeAmount = BigInt(
            parseUnits('2', chainPrecision).toString(),
          );
          const expectedFeeAmount = receiveTxCost + extraNativeAmount;
          const response = await bridgePayer
            .connect(alice)
            .bridgeCctp(
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              messengerProtocol,
              requiredAbrAmount + extraAbrAmount,
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
          const response = await bridgePayer
            .connect(alice)
            .bridgeCctp(
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              messengerProtocol,
              abrAmount,
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

        it('Failure: should revert when not enough ABR tokens to cover the bridging fee', async function () {
          const lowAbrAmount = parseUnits('0.1', abrTokenPrecision);
          await expect(
            bridgePayer
              .connect(alice)
              .bridgeCctp(
                amount,
                addressToBytes32(recipient),
                destinationChainId,
                messengerProtocol,
                lowAbrAmount,
              ),
          ).revertedWith('Payer: not enough fee');
        });
      });

      describe('bridgeOft', function () {
        const amount = parseUnits('100', tokenPrecision);
        const recipient = '0x40818739e51057D984B05Cbc82fee9B15A95674F';
        const destinationChainId = CHAIN_2;
        const extraGasInDestinationToken = 0;
        const slippageBP = 50;
        const messengerProtocol = 5;
        const relayerFeeAmount = parseUnits('2', chainPrecision).toString();

        beforeEach(async function () {
          await owner.sendTransaction({
            to: bridgePayer.address,
            value: ethers.utils.parseEther('10'),
          });
          await bridgePayer.approveBridgeToken(token.address);
          await bridgePayer.setExchangeRate(
            parseUnits('0.5', EXCHANGE_RATE_PRECISION),
          );
          await oftBridge.mockRelayerFee(relayerFeeAmount);
        });

        it('Success: should charge ABR tokens', async function () {
          const abrAmount = parseUnits('1', abrTokenPrecision);
          const response = await bridgePayer
            .connect(alice)
            .bridgeOft(
              token.address,
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              extraGasInDestinationToken,
              slippageBP,
              abrAmount,
            );
          expect(response).to.changeTokenBalances(
            abrToken,
            [alice, bridgePayer],
            ['-' + abrAmount.toString(), abrAmount.toString()],
          );
        });

        it('Success: should call OFT bridge with required native tokens value', async function () {
          const abrAmount = await bridgePayer.getBridgeFeeInAbr(
            destinationChainId,
            messengerProtocol,
            token.address,
            amount,
          );

          const expectedFeeAmount = relayerFeeAmount;
          const response = await bridgePayer
            .connect(alice)
            .bridgeOft(
              token.address,
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              extraGasInDestinationToken,
              slippageBP,
              abrAmount,
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
          const response = await bridgePayer
            .connect(alice)
            .bridgeOft(
              token.address,
              amount,
              addressToBytes32(recipient),
              destinationChainId,
              extraGasInDestinationToken,
              slippageBP,
              abrAmount,
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

      describe('getBridgeFeeInAbr', () => {
        const destinationChainId = CHAIN_2;
        const messengerProtocol = 1;
        it('Success: should return the correct fee amount in ABR', async function () {
          // 0.5 ABR/TRX
          const exchangeRate = 0.5;
          await bridgePayer.setExchangeRate(
            parseUnits(exchangeRate.toString(), EXCHANGE_RATE_PRECISION),
          );
          const bridgingCost = BigInt(
            parseUnits('1', chainPrecision).toString(),
          );
          const messageCost = BigInt(
            parseUnits('1', chainPrecision).toString(),
          );
          await bridge.mockTransactionCost(bridgingCost);
          await bridge.mockMessageCost(messageCost);

          const expectedAmount = parseUnits('1', abrTokenPrecision);
          const amount = await bridgePayer.getBridgeFeeInAbr(
            destinationChainId,
            messengerProtocol,
            ethers.constants.AddressZero,
            '0',
          );
          expect(amount.toString()).to.equal(expectedAmount);
        });
      });

      describe('Admin methods', () => {
        describe('setExchangeRate', () => {
          const rate = parseUnits('0.0001', EXCHANGE_RATE_PRECISION).toString();

          it('Success: should set exchange rate', async () => {
            await bridgePayer.setExchangeRate(rate);
            expect((await bridgePayer.exchangeRate()).toString()).to.eq(rate);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridgePayer.connect(alice).setExchangeRate(rate),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('setBridge', () => {
          const newBridge = '0xf2042dEff251a1B4ea1Da9d1e952a62cD626fDb3';

          it('Success: should set bridge', async () => {
            await bridgePayer.setBridge(newBridge);
            expect(await bridgePayer.bridge()).to.eq(newBridge);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridgePayer.connect(alice).setBridge(newBridge),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('setCctpBridge', () => {
          const newBridge = '0xf2042dEff251a1B4ea1Da9d1e952a62cD626fDb3';

          it('Success: should set CCTP bridge', async () => {
            await bridgePayer.setCctpBridge(newBridge, token.address);
            expect(await bridgePayer.cctpBridge()).to.eq(newBridge);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridgePayer
                .connect(alice)
                .setCctpBridge(newBridge, token.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('setCctpV2Bridge', () => {
          const newBridge = '0xf2042dEff251a1B4ea1Da9d1e952a62cD626fDb3';

          it('Success: should set CCTP V2 bridge', async () => {
            await bridgePayer.setCctpV2Bridge(newBridge, token.address);
            expect(await bridgePayer.cctpV2Bridge()).to.eq(newBridge);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridgePayer
                .connect(alice)
                .setCctpV2Bridge(newBridge, token.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('setOftBridge', () => {
          const newBridge = '0xf2042dEff251a1B4ea1Da9d1e952a62cD626fDb3';

          it('Success: should set OFT bridge', async () => {
            await bridgePayer.setOftBridge(newBridge);
            expect(await bridgePayer.oftBridge()).to.eq(newBridge);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridgePayer.connect(alice).setOftBridge(newBridge),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('approveBridgeToken', () => {
          it('Success: should approve bridge', async () => {
            await bridgePayer.approveBridgeToken(token.address);
            expect(
              await token.allowance(bridgePayer.address, bridge.address),
            ).to.eq(ethers.constants.MaxUint256);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridgePayer.connect(alice).approveBridgeToken(token.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('withdrawGas', () => {
          const amount = '123456789123456789';
          beforeEach(async function () {
            await alice.sendTransaction({
              to: bridgePayer.address,
              value: amount,
            });
          });

          it('Success: should withdraw gas', async () => {
            await expect(
              await bridgePayer.withdrawGas(amount),
            ).changeEtherBalances([owner, bridgePayer], [amount, '-' + amount]);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridgePayer.connect(alice).withdrawGas(amount),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('withdrawTokens', () => {
          const amount = '123456789123456789';
          beforeEach(async function () {
            await abrToken.transfer(bridgePayer.address, amount);
          });

          it('Success: should withdraw tokens', async () => {
            await expect(() =>
              bridgePayer.withdrawTokens(abrToken.address),
            ).to.changeTokenBalances(
              abrToken,
              [bridgePayer, owner],
              ['-' + amount.toString(), amount.toString()],
            );
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              bridgePayer.connect(alice).withdrawTokens(abrToken.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });
      });
    });
  }
});
