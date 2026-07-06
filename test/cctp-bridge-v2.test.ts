import { ethers } from 'hardhat';
import { assert, expect } from 'chai';
import {
  CctpV2Bridge,
  MockGasOracle,
  MockReceiver,
  MockTokenMessengerV2,
  Token,
} from '../typechain';
import { addressToBase32, encodeAsHex } from './utils';
import { parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { Big } from 'big.js';
import { BigNumber, BigNumberish } from '@ethersproject/bignumber';
import { sorobanAddressToBytes32 } from '../scripts/helper';

const CURRENT_CHAIN_ID = 1;
const OTHER_CHAIN_ID = 2;
const OTHER_DOMAIN = 22;
const ORACLE_PRECISION = 18;
const MAX_FEE_SHARE_P = 1e9;

const calcMaxFee = (
  amount: BigNumberish,
  relayerFeeTokenAmount: BigNumberish,
  maxFeeShare: BigNumberish = 100_000,
  adminFeeAmount: BigNumberish = 0,
) => {
  const v = BigNumber.from(amount)
    .sub(relayerFeeTokenAmount)
    .sub(adminFeeAmount);

  return BigNumber.from(v.mul(maxFeeShare).div(MAX_FEE_SHARE_P).add(1));
};

describe('CctpV2Bridge', () => {
  const currentChainPrecision = 18;
  const tokenPrecision = 18;
  const gasAmountOfFinalizingTransfer = 1000;
  const costOfFinalizingTransfer = 10_000;
  const amount = parseUnits('1000', tokenPrecision);
  const destinationCaller = addressToBase32(
    '0x36ABB6dE7299056747342F515D00A164BB03c6d4',
  );

  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  let token: Token;
  let mockGasOracle: MockGasOracle;
  let mockedCctpMessengerV2: MockTokenMessengerV2;
  let mockedCctpTransmitter: MockReceiver;
  let cctpV2Bridge: CctpV2Bridge;

  before(async () => {
    [owner, user] = await ethers.getSigners();
  });

  async function setupContractsFixture() {
    token = (await ethers.deployContract('Token', [
      'A',
      'A',
      parseUnits('100000000000000000000', tokenPrecision),
      tokenPrecision,
    ])) as Token;

    const MockGasOracle = await ethers.getContractFactory('MockGasOracle');
    mockGasOracle = await MockGasOracle.deploy();
    await mockGasOracle.deployed();

    const MockTokenMessengerV2 = await ethers.getContractFactory(
      'MockTokenMessengerV2',
    );
    mockedCctpMessengerV2 = await MockTokenMessengerV2.deploy();
    await mockedCctpMessengerV2.deployed();

    const MockReceiver = await ethers.getContractFactory('MockReceiver');
    mockedCctpTransmitter = await MockReceiver.deploy();
    await mockedCctpTransmitter.deployed();

    cctpV2Bridge = (await ethers.deployContract('CctpV2Bridge', [
      CURRENT_CHAIN_ID,
      currentChainPrecision,
      token.address,
      mockedCctpMessengerV2.address,
      mockedCctpTransmitter.address,
      mockGasOracle.address,
    ])) as CctpV2Bridge;

    await cctpV2Bridge.setGasUsage(
      OTHER_CHAIN_ID,
      gasAmountOfFinalizingTransfer,
    );
    await cctpV2Bridge.registerBridgeDestination(
      OTHER_CHAIN_ID,
      OTHER_DOMAIN,
      destinationCaller,
    );
    await owner.sendTransaction({
      to: cctpV2Bridge.address,
      value: parseUnits('10', currentChainPrecision),
    });
    await token.transfer(user.address, amount);
    await token.connect(user).approve(cctpV2Bridge.address, amount);
    await cctpV2Bridge.setAdminFeeShare(0);
  }

  beforeEach(async () => {
    await loadFixture(setupContractsFixture);
    assert(
      +(await token.decimals()) === tokenPrecision,
      'Invalid test configuration: unexpected token precision',
    );
  });

  describe('#bridge', () => {
    let recipient: string;

    beforeEach(async () => {
      recipient = addressToBase32(user.address);
      const ethPriceInUsd = '2000';
      await mockGasOracle.setPrice(
        CURRENT_CHAIN_ID,
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );
      await mockGasOracle.mockTransactionGasCostInNativeToken(
        costOfFinalizingTransfer,
      );
    });

    afterEach(async () => {
      await mockGasOracle.setPrice(OTHER_CHAIN_ID, 0);
      await mockGasOracle.mockTransactionGasCostInNativeToken(0);
    });

    it('Success: should send tokens and accept gas as bridging fee', async () => {
      const value = parseUnits('0.001', currentChainPrecision);
      const relayerFeeTokenAmount = '0';
      const tx = await cctpV2Bridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, relayerFeeTokenAmount, {
          value,
        });

      const maxFee = calcMaxFee(amount, relayerFeeTokenAmount);

      await expect(tx)
        .to.emit(mockedCctpMessengerV2, 'DepositForBurnEvent')
        .withArgs(
          amount,
          OTHER_DOMAIN,
          recipient,
          token.address,
          destinationCaller,
          maxFee,
          1000,
        );

      await expect(tx)
        .to.emit(cctpV2Bridge, 'TokensSent')
        .withArgs(
          user.address,
          recipient,
          amount,
          OTHER_CHAIN_ID,
          value,
          '0',
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          '0',
          maxFee,
        );
    });

    it('Success: should send tokens and accept tokens as bridging fee', async () => {
      const feeInUsd = Big(50);
      const ethPriceInUsd = '2000';
      const relayerFeeTokenAmount = parseUnits(
        feeInUsd.toString(),
        tokenPrecision,
      );
      const expectedSentAmount = amount.sub(relayerFeeTokenAmount);
      const feeInEth = feeInUsd.div(ethPriceInUsd);
      const expectedRelayerFeeAmountFromStables = parseUnits(
        feeInEth.toString(),
        currentChainPrecision,
      );

      await mockGasOracle.setPrice(
        OTHER_CHAIN_ID,
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );

      const tx = await cctpV2Bridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, relayerFeeTokenAmount, {
          value: '0',
        });

      const maxFee = calcMaxFee(amount, relayerFeeTokenAmount);

      await expect(tx)
        .to.emit(mockedCctpMessengerV2, 'DepositForBurnEvent')
        .withArgs(
          expectedSentAmount,
          OTHER_DOMAIN,
          recipient,
          token.address,
          destinationCaller,
          maxFee,
          1000,
        );

      await expect(tx)
        .to.emit(cctpV2Bridge, 'TokensSent')
        .withArgs(
          user.address,
          recipient,
          expectedSentAmount,
          OTHER_CHAIN_ID,
          '0',
          expectedRelayerFeeAmountFromStables,
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          '0',
          maxFee,
        );
    });

    it('Success with wallet address: should send tokens and accept tokens as bridging fee', async () => {
      const feeInUsd = Big(50);
      const ethPriceInUsd = '2000';
      const relayerFeeTokenAmount = parseUnits(
        feeInUsd.toString(),
        tokenPrecision,
      );
      const recipientWalletAddress =
        '0x1122334455667788990011223344556677889900112233445566778899001122';
      const expectedSentAmount = amount.sub(relayerFeeTokenAmount);
      const feeInEth = feeInUsd.div(ethPriceInUsd);
      const expectedRelayerFeeAmountFromStables = parseUnits(
        feeInEth.toString(),
        currentChainPrecision,
      );

      await mockGasOracle.setPrice(
        OTHER_CHAIN_ID,
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );

      const tx = await cctpV2Bridge
        .connect(user)
        .bridgeWithWalletAddress(
          amount,
          recipient,
          recipientWalletAddress,
          OTHER_CHAIN_ID,
          relayerFeeTokenAmount,
          {
            value: '0',
          },
        );

      const maxFee = calcMaxFee(amount, relayerFeeTokenAmount);

      await expect(tx)
        .to.emit(mockedCctpMessengerV2, 'DepositForBurnEvent')
        .withArgs(
          expectedSentAmount,
          OTHER_DOMAIN,
          recipient,
          token.address,
          destinationCaller,
          maxFee,
          1000,
        );

      await expect(tx)
        .to.emit(cctpV2Bridge, 'TokensSent')
        .withArgs(
          user.address,
          recipient,
          expectedSentAmount,
          OTHER_CHAIN_ID,
          '0',
          expectedRelayerFeeAmountFromStables,
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          '0',
          maxFee,
        );

      await expect(tx)
        .to.emit(cctpV2Bridge, 'TokensSentExtras')
        .withArgs(recipientWalletAddress);
    });

    it('Success with hook: should pass raw destination address as hook data', async () => {
      const value = parseUnits('0.001', currentChainPrecision);
      const relayerFeeTokenAmount = '0';
      const destinationBridgeAddress = 'CDZZZTN6RXOWY2WDJV2GLFAV76YKAIRFPNB4EABMFAVJQ5DCZIAE4DYA';
      const mintRecipient = sorobanAddressToBytes32(destinationBridgeAddress);
      const hookData =
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

      const tx = await cctpV2Bridge
        .connect(user)
        .bridgeWithHook(
          amount,
          mintRecipient,
          OTHER_CHAIN_ID,
          relayerFeeTokenAmount,
          hookData,
          { value },
        );

      const maxFee = calcMaxFee(amount, relayerFeeTokenAmount);

      await expect(tx)
        .to.emit(mockedCctpMessengerV2, 'DepositForBurnWithHookEvent')
        .withArgs(
          amount,
          OTHER_DOMAIN,
          mintRecipient,
          token.address,
          destinationCaller,
          maxFee,
          1000,
          hookData,
        );

      await expect(tx)
        .to.emit(cctpV2Bridge, 'TokensSentWithHook')
        .withArgs(
          user.address,
          mintRecipient,
          amount,
          OTHER_CHAIN_ID,
          value,
          '0',
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          '0',
          maxFee,
          hookData,
        );
    });

    it('Success: should charge admin fee', async () => {
      const amount = parseUnits('1000', tokenPrecision);
      const relayerFeeTokenAmount = parseUnits('50', tokenPrecision);
      const adminFeeSharePercent = 0.5;
      const adminFeeAmount = parseUnits('4.75', tokenPrecision);
      const expectedSentAmount = amount
        .sub(relayerFeeTokenAmount)
        .sub(adminFeeAmount);
      const expectedRelayerFeeAmountFromStables = parseUnits(
        '0.025',
        currentChainPrecision,
      );

      const adminFeeShareBp = adminFeeSharePercent * 100;
      await cctpV2Bridge.setAdminFeeShare(adminFeeShareBp);

      const ethPriceInUsd = '2000';
      await mockGasOracle.setPrice(
        OTHER_CHAIN_ID,
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );

      const tx = await cctpV2Bridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, relayerFeeTokenAmount, {
          value: '0',
        });

      const maxFee = calcMaxFee(
        amount,
        relayerFeeTokenAmount,
        100_000,
        adminFeeAmount,
      );
      await expect(tx)
        .to.emit(mockedCctpMessengerV2, 'DepositForBurnEvent')
        .withArgs(
          expectedSentAmount,
          OTHER_DOMAIN,
          recipient,
          token.address,
          destinationCaller,
          maxFee,
          1000,
        );

      await expect(tx)
        .to.emit(cctpV2Bridge, 'TokensSent')
        .withArgs(
          user.address,
          recipient,
          expectedSentAmount,
          OTHER_CHAIN_ID,
          '0',
          expectedRelayerFeeAmountFromStables,
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          adminFeeAmount,
          maxFee,
        );
    });

    it('Success: should charge min admin fee', async () => {
      const minAdminFeeAmount = 1;
      const amount = 1000;
      const value = parseUnits('0.001', currentChainPrecision);
      const relayerFeeTokenAmount = '0';
      const expectedSentAmount = Big(amount)
        .sub(relayerFeeTokenAmount)
        .sub(minAdminFeeAmount)
        .toFixed();

      await cctpV2Bridge.setAdminFeeShare(1);

      const ethPriceInUsd = '2000';
      await mockGasOracle.setPrice(
        OTHER_CHAIN_ID,
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );

      const tx = await cctpV2Bridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, relayerFeeTokenAmount, {
          value,
        });

      const maxFee = calcMaxFee(
        amount,
        relayerFeeTokenAmount,
        100_000,
        minAdminFeeAmount,
      );
      await expect(tx)
        .to.emit(mockedCctpMessengerV2, 'DepositForBurnEvent')
        .withArgs(
          expectedSentAmount,
          OTHER_DOMAIN,
          recipient,
          token.address,
          destinationCaller,
          maxFee,
          1000,
        );

      await expect(tx)
        .to.emit(cctpV2Bridge, 'TokensSent')
        .withArgs(
          user.address,
          recipient,
          expectedSentAmount,
          OTHER_CHAIN_ID,
          value,
          '0',
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          minAdminFeeAmount,
          maxFee,
        );
    });

    it('Failure: should revert when sent gas is not enough for relayer fee', async () => {
      const value = parseUnits('0.001', currentChainPrecision);
      await mockGasOracle.mockTransactionGasCostInNativeToken(value.add(1));
      const response = cctpV2Bridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, '0', { value });
      await expect(response).revertedWith('Not enough fee');
    });

    it('Failure: should revert when destination is unknown', async () => {
      const unknownChainId = 99;
      const value = parseUnits('0.001', currentChainPrecision);
      await mockGasOracle.mockTransactionGasCostInNativeToken(
        costOfFinalizingTransfer,
      );
      const response = cctpV2Bridge
        .connect(user)
        .bridge(amount, recipient, unknownChainId, '0', { value });
      await expect(response).revertedWith('Unknown chain id');
    });
  });

  describe('#receiveTokens', () => {
    let recipient: string;
    const message = encodeAsHex('message');
    const signature = encodeAsHex('signature');

    beforeEach(async () => {
      recipient = user.address;
      await mockedCctpTransmitter.mockReceiveMessageResult(true);
    });

    afterEach(async () => {
      await mockedCctpTransmitter.mockReceiveMessageResult(false);
    });

    it('Success: should invoke receiveMessage', async () => {
      const sentTxId = addressToBase32('0x1');

      const tx = await cctpV2Bridge
        .connect(owner)
        .receiveTokens(recipient, sentTxId, message, signature, {
          value: '0',
        });

      await expect(tx)
        .to.emit(mockedCctpTransmitter, 'ReceiveMessageEvent')
        .withArgs(message, signature);
      await expect(tx)
        .to.emit(cctpV2Bridge, 'ReceivedMessageId')
        .withArgs(sentTxId);
    });

    it('Success: should pass extra gas to the recipient', async () => {
      const sentTxId = addressToBase32('0x1');
      const extraGasAmount = parseUnits('0.001', currentChainPrecision);

      const tx = await cctpV2Bridge
        .connect(owner)
        .receiveTokens(recipient, sentTxId, message, signature, {
          value: extraGasAmount,
        });
      await expect(tx).to.changeEtherBalance(
        await ethers.getSigner(recipient),
        extraGasAmount,
      );

      await expect(tx)
        .to.emit(cctpV2Bridge, 'ReceivedExtraGas')
        .withArgs(recipient, extraGasAmount);

      await expect(tx)
        .to.emit(mockedCctpTransmitter, 'ReceiveMessageEvent')
        .withArgs(message, signature);
      await expect(tx)
        .to.emit(cctpV2Bridge, 'ReceivedMessageId')
        .withArgs(sentTxId);
    });

    it('Failure: should revert when receiveMessage fails', async () => {
      await mockedCctpTransmitter.mockReceiveMessageResult(false);

      const extraGasAmount = parseUnits('0.001', currentChainPrecision);
      const response = cctpV2Bridge
        .connect(owner)
        .receiveTokens(recipient, addressToBase32('0x1'), message, signature, {
          value: extraGasAmount,
        });
      await expect(response).revertedWith('Receive message failed');
    });

    it('Failure: should be OK when passing extra gas fails', async () => {
      const invalidGasRecipient = token.address;
      const extraGasAmount = parseUnits('0.001', currentChainPrecision);
      const sentTxId = addressToBase32('0x1');

      const tx = await cctpV2Bridge
        .connect(owner)
        .receiveTokens(invalidGasRecipient, sentTxId, message, signature, {
          value: extraGasAmount,
        });
      await expect(tx).to.changeEtherBalance(
        await ethers.getSigner(invalidGasRecipient),
        '0',
      );

      await expect(tx)
        .to.emit(mockedCctpTransmitter, 'ReceiveMessageEvent')
        .withArgs(message, signature);
      await expect(tx)
        .to.emit(cctpV2Bridge, 'ReceivedMessageId')
        .withArgs(sentTxId);
    });
  });

  describe('#getDomainByChainId', () => {
    it('Success: should return domain', async () => {
      const actual = await cctpV2Bridge.getDomainByChainId(OTHER_CHAIN_ID);
      expect(actual).to.equal(OTHER_DOMAIN);
    });

    it('Failure: should revert when chain ID is not registered', async () => {
      const unknownChainId = 0;
      await expect(
        cctpV2Bridge.getDomainByChainId(unknownChainId),
      ).revertedWith('Unknown chain id');
    });
  });

  describe('Admin methods', () => {
    describe('#registerBridgeDestination', () => {
      const newChainId = 9;
      const newDomain = 99;
      const newDestinationBridgeAddress = addressToBase32(
        '0x36ABB6dE7299056747342F515D00A164BB03c6d4',
      );
      it('Success: should register new domain', async () => {
        await cctpV2Bridge.registerBridgeDestination(
          newChainId,
          newDomain,
          newDestinationBridgeAddress,
        );
        const actualDomain = await cctpV2Bridge.getDomainByChainId(newChainId);
        expect(actualDomain).to.equal(newDomain);
      });

      it('Success: should register domain 0', async () => {
        await cctpV2Bridge.registerBridgeDestination(
          newChainId,
          0,
          addressToBase32('0x00'),
        );
        const actualDomain = await cctpV2Bridge.getDomainByChainId(newChainId);
        expect(actualDomain).to.equal(0);
      });

      it('Success: should register new bridge address', async () => {
        await cctpV2Bridge.registerBridgeDestination(
          newChainId,
          newDomain,
          newDestinationBridgeAddress,
        );
        const actual = await cctpV2Bridge.otherBridges(newChainId);
        expect(actual).to.equal(newDestinationBridgeAddress);
      });

      it('Success: should register empty destination bridge address', async () => {
        await cctpV2Bridge.registerBridgeDestination(
          newChainId,
          newDomain,
          addressToBase32('0x00'),
        );
        const actual = await cctpV2Bridge.otherBridges(newChainId);
        expect(actual).to.equal(addressToBase32('0x00'));
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          cctpV2Bridge
            .connect(user)
            .registerBridgeDestination(
              newChainId,
              newDomain,
              newDestinationBridgeAddress,
            ),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('#unregisterBridgeDestination', () => {
      it('Success: should unregister the chain', async () => {
        await cctpV2Bridge.unregisterBridgeDestination(OTHER_CHAIN_ID);
        await expect(
          cctpV2Bridge.getDomainByChainId(OTHER_CHAIN_ID),
        ).revertedWith('Unknown chain id');
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          cctpV2Bridge
            .connect(user)
            .unregisterBridgeDestination(OTHER_CHAIN_ID),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('#withdrawGas', () => {
      const value = parseUnits('0.001', currentChainPrecision).toBigInt();

      beforeEach(async () => {
        await owner.sendTransaction({
          to: cctpV2Bridge.address,
          value,
        });
      });

      it('Success: should withdraw gas', async () => {
        await expect(await cctpV2Bridge.withdrawGas(value)).changeEtherBalances(
          [owner, cctpV2Bridge],
          [value, -1n * value],
        );
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(cctpV2Bridge.connect(user).withdrawGas('1')).revertedWith(
          'Ownable: caller is not the owner',
        );
      });
    });

    describe('#withdrawFeeInTokens', () => {
      const feeTokenAmount = parseUnits('0.1', tokenPrecision).toBigInt();

      beforeEach(async () => {
        assert(
          (await token.balanceOf(cctpV2Bridge.address)).eq(0),
          'Invalid test configuration: unexpected cctpBridge token balance.',
        );
        await token.transfer(cctpV2Bridge.address, feeTokenAmount);
      });

      it('Success: should transfer accumulated fee to the owner', async () => {
        await expect(() =>
          cctpV2Bridge.withdrawFeeInTokens(),
        ).to.changeTokenBalance(token, owner, feeTokenAmount);
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          cctpV2Bridge.connect(user).withdrawFeeInTokens(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('#setAdminFeeShare', () => {
      const newAdminFeeShareBp = 1000;
      it('Success: should set new adminFeeShareBp', async () => {
        await cctpV2Bridge.setAdminFeeShare(newAdminFeeShareBp);
        const actual = await cctpV2Bridge.adminFeeShareBP();
        expect(actual).to.equal(newAdminFeeShareBp);
      });

      it('Failure: should revert when the new fee is more than 100%', async () => {
        await expect(cctpV2Bridge.setAdminFeeShare(10001)).to.be.revertedWith(
          'Too high',
        );
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          cctpV2Bridge.connect(user).setAdminFeeShare(newAdminFeeShareBp),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });
  });
});
