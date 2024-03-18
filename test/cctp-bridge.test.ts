import { ethers } from 'hardhat';
import chai, { assert, expect } from 'chai';
import {
  CctpBridge,
  GasOracle,
  // eslint-disable-next-line camelcase
  GasOracle__factory,
  IReceiver,
  ITokenMessenger,
  Token,
} from '../typechain';
import { addressToBase32, encodeAsHex } from './utils';
import { parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { FakeContract, MockContract, smock } from '@defi-wonderland/smock';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { Big } from 'big.js';

const { mock, fake } = smock;
chai.use(smock.matchers);

const CURRENT_CHAIN_ID = 1;
const OTHER_CHAIN_ID = 2;
const OTHER_DOMAIN = 22;
const ORACLE_PRECISION = 18;

describe('CctpBridge', () => {
  const currentChainPrecision = 18;
  const tokenPrecision = 18;
  const nonce = 18167805839882137372n;
  const gasAmountOfFinalizingTransfer = 1000;
  const costOfFinalizingTransfer = 10_000;
  const amount = parseUnits('1000', tokenPrecision);

  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  let token: Token;
  let mockedGasOracle: MockContract<GasOracle>;
  let mockedCctpMessenger: FakeContract<ITokenMessenger>;
  let mockedCctpTransmitter: FakeContract<IReceiver>;
  let cctpBridge: CctpBridge;

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

    // eslint-disable-next-line camelcase
    const gasOracleFactory = await mock<GasOracle__factory>('GasOracle');
    mockedGasOracle = await gasOracleFactory.deploy(
      CURRENT_CHAIN_ID,
      ORACLE_PRECISION,
    );

    mockedCctpMessenger = await fake<ITokenMessenger>('ITokenMessenger');
    mockedCctpTransmitter = await fake<IReceiver>('IReceiver');

    cctpBridge = (await ethers.deployContract('CctpBridge', [
      CURRENT_CHAIN_ID,
      currentChainPrecision,
      token.address,
      mockedCctpMessenger.address,
      mockedCctpTransmitter.address,
      mockedGasOracle.address,
    ])) as CctpBridge;

    await cctpBridge.setGasUsage(OTHER_CHAIN_ID, gasAmountOfFinalizingTransfer);
    await cctpBridge.registerBridgeDestination(OTHER_CHAIN_ID, OTHER_DOMAIN);
    await owner.sendTransaction({
      to: cctpBridge.address,
      value: parseUnits('10', currentChainPrecision),
    });
    await token.transfer(user.address, amount);
    await token.connect(user).approve(cctpBridge.address, amount);
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
      mockedGasOracle.getTransactionGasCostInNativeToken
        .whenCalledWith(OTHER_CHAIN_ID, gasAmountOfFinalizingTransfer)
        .returns(costOfFinalizingTransfer);
      mockedCctpMessenger.depositForBurn.returns(nonce);
    });

    afterEach(async () => {
      mockedGasOracle.price.reset();
      mockedGasOracle.getTransactionGasCostInNativeToken.reset();
      mockedCctpMessenger.depositForBurn.reset();
    });

    it('Success: should send tokens and accept gas as bridging fee', async () => {
      const value = parseUnits('0.001', currentChainPrecision);
      const relayerFeeTokenAmount = '0';
      const tx = await cctpBridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, relayerFeeTokenAmount, {
          value,
        });

      expect(mockedCctpMessenger.depositForBurn).to.have.been.calledOnceWith(
        amount,
        OTHER_DOMAIN,
        recipient,
        token.address,
      );

      await expect(tx)
        .to.emit(cctpBridge, 'TokensSent')
        .withArgs(
          amount,
          user.address,
          recipient,
          OTHER_CHAIN_ID,
          nonce,
          value,
          '0',
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          '0',
          recipient,
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

      mockedGasOracle.price.returns(
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );

      const tx = await cctpBridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, relayerFeeTokenAmount, {
          value: '0',
        });

      expect(mockedCctpMessenger.depositForBurn).to.have.been.calledOnceWith(
        expectedSentAmount,
        OTHER_DOMAIN,
        recipient,
        token.address,
      );

      await expect(tx)
        .to.emit(cctpBridge, 'TokensSent')
        .withArgs(
          expectedSentAmount,
          user.address,
          recipient,
          OTHER_CHAIN_ID,
          nonce,
          '0',
          expectedRelayerFeeAmountFromStables,
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          '0',
          recipient,
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

      mockedGasOracle.price.returns(
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );

      const tx = await cctpBridge
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

      expect(mockedCctpMessenger.depositForBurn).to.have.been.calledOnceWith(
        expectedSentAmount,
        OTHER_DOMAIN,
        recipient,
        token.address,
      );

      await expect(tx)
        .to.emit(cctpBridge, 'TokensSent')
        .withArgs(
          expectedSentAmount,
          user.address,
          recipient,
          OTHER_CHAIN_ID,
          nonce,
          '0',
          expectedRelayerFeeAmountFromStables,
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          '0',
          recipientWalletAddress,
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
      await cctpBridge.setAdminFeeShare(adminFeeShareBp);

      const ethPriceInUsd = '2000';
      mockedGasOracle.price.returns(
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );

      const tx = await cctpBridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, relayerFeeTokenAmount, {
          value: '0',
        });

      expect(mockedCctpMessenger.depositForBurn).to.have.been.calledOnceWith(
        expectedSentAmount,
        OTHER_DOMAIN,
        recipient,
        token.address,
      );

      await expect(tx)
        .to.emit(cctpBridge, 'TokensSent')
        .withArgs(
          expectedSentAmount,
          user.address,
          recipient,
          OTHER_CHAIN_ID,
          nonce,
          '0',
          expectedRelayerFeeAmountFromStables,
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          adminFeeAmount,
          recipient,
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

      await cctpBridge.setAdminFeeShare(1);

      const ethPriceInUsd = '2000';
      mockedGasOracle.price.returns(
        parseUnits(ethPriceInUsd, ORACLE_PRECISION),
      );

      const tx = await cctpBridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, relayerFeeTokenAmount, {
          value,
        });

      expect(mockedCctpMessenger.depositForBurn).to.have.been.calledOnceWith(
        expectedSentAmount,
        OTHER_DOMAIN,
        recipient,
        token.address,
      );

      await expect(tx)
        .to.emit(cctpBridge, 'TokensSent')
        .withArgs(
          expectedSentAmount,
          user.address,
          recipient,
          OTHER_CHAIN_ID,
          nonce,
          value,
          '0',
          costOfFinalizingTransfer,
          relayerFeeTokenAmount,
          minAdminFeeAmount,
          recipient,
        );
    });

    it('Failure: should revert when sent gas is not enough for relayer fee', async () => {
      const value = parseUnits('0.001', currentChainPrecision);
      mockedGasOracle.getTransactionGasCostInNativeToken.reset();
      mockedGasOracle.getTransactionGasCostInNativeToken.returns(value.add(1));
      const response = cctpBridge
        .connect(user)
        .bridge(amount, recipient, OTHER_CHAIN_ID, '0', { value });
      await expect(response).revertedWith('Not enough fee');
    });

    it('Failure: should revert when destination is unknown', async () => {
      const unknownChainId = 99;
      const value = parseUnits('0.001', currentChainPrecision);
      mockedGasOracle.getTransactionGasCostInNativeToken.returns(
        costOfFinalizingTransfer,
      );
      const response = cctpBridge
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
      mockedCctpTransmitter.receiveMessage.returns(true);
    });

    afterEach(async () => {
      mockedCctpTransmitter.receiveMessage.reset();
    });

    it('Success: should invoke receiveMessage', async () => {
      await cctpBridge
        .connect(owner)
        .receiveTokens(recipient, message, signature, { value: '0' });

      expect(mockedCctpTransmitter.receiveMessage).to.have.been.calledOnceWith(
        message,
        signature,
      );
    });

    it('Success: should pass extra gas to the recipient', async () => {
      const extraGasAmount = parseUnits('0.001', currentChainPrecision);

      const tx = await cctpBridge
        .connect(owner)
        .receiveTokens(recipient, message, signature, {
          value: extraGasAmount,
        });
      await expect(tx).to.changeEtherBalance(
        await ethers.getSigner(recipient),
        extraGasAmount,
      );

      await expect(tx)
        .to.emit(cctpBridge, 'ReceivedExtraGas')
        .withArgs(recipient, extraGasAmount);

      expect(mockedCctpTransmitter.receiveMessage).to.have.been.calledOnceWith(
        message,
        signature,
      );
    });

    it('Failure: should revert when receiveMessage fails', async () => {
      mockedCctpTransmitter.receiveMessage.returns(false);

      const extraGasAmount = parseUnits('0.001', currentChainPrecision);
      const response = cctpBridge
        .connect(owner)
        .receiveTokens(recipient, message, signature, {
          value: extraGasAmount,
        });
      await expect(response).revertedWith('Receive message failed');
    });

    it('Failure: should be OK when passing extra gas fails', async () => {
      const invalidGasRecipient = token.address;
      const extraGasAmount = parseUnits('0.001', currentChainPrecision);

      const tx = await cctpBridge
        .connect(owner)
        .receiveTokens(invalidGasRecipient, message, signature, {
          value: extraGasAmount,
        });
      await expect(tx).to.changeEtherBalance(
        await ethers.getSigner(invalidGasRecipient),
        '0',
      );

      expect(mockedCctpTransmitter.receiveMessage).to.have.been.calledOnceWith(
        message,
        signature,
      );
    });
  });

  describe('#getDomainByChainId', () => {
    it('Success: should return domain', async () => {
      const actual = await cctpBridge.getDomainByChainId(OTHER_CHAIN_ID);
      expect(actual).to.equal(OTHER_DOMAIN);
    });

    it('Failure: should revert when chain ID is not registered', async () => {
      const unknownChainId = 0;
      await expect(cctpBridge.getDomainByChainId(unknownChainId)).revertedWith(
        'Unknown chain id',
      );
    });
  });

  describe('Admin methods', () => {
    describe('#registerBridgeDestination', () => {
      const newChainId = 9;
      const newDomain = 99;
      it('Success: should register new domain', async () => {
        await cctpBridge.registerBridgeDestination(newChainId, newDomain);
        const actualDomain = await cctpBridge.getDomainByChainId(newChainId);
        expect(actualDomain).to.equal(newDomain);
      });

      it('Success: should register domain 0', async () => {
        await cctpBridge.registerBridgeDestination(newChainId, 0);
        const actualDomain = await cctpBridge.getDomainByChainId(newChainId);
        expect(actualDomain).to.equal(0);
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          cctpBridge
            .connect(user)
            .registerBridgeDestination(newChainId, newDomain),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('#unregisterBridgeDestination', () => {
      it('Success: should unregister the chain', async () => {
        await cctpBridge.unregisterBridgeDestination(OTHER_CHAIN_ID);
        await expect(
          cctpBridge.getDomainByChainId(OTHER_CHAIN_ID),
        ).revertedWith('Unknown chain id');
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          cctpBridge.connect(user).unregisterBridgeDestination(OTHER_CHAIN_ID),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('#withdrawGas', () => {
      const value = parseUnits('0.001', currentChainPrecision).toBigInt();

      beforeEach(async () => {
        await owner.sendTransaction({
          to: cctpBridge.address,
          value,
        });
      });

      it('Success: should withdraw gas', async () => {
        await expect(await cctpBridge.withdrawGas(value)).changeEtherBalances(
          [owner, cctpBridge],
          [value, -1n * value],
        );
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(cctpBridge.connect(user).withdrawGas('1')).revertedWith(
          'Ownable: caller is not the owner',
        );
      });
    });

    describe('#withdrawFeeInTokens', () => {
      const feeTokenAmount = parseUnits('0.1', tokenPrecision).toBigInt();

      beforeEach(async () => {
        assert(
          (await token.balanceOf(cctpBridge.address)).eq(0),
          'Invalid test configuration: unexpected cctpBridge token balance.',
        );
        await token.transfer(cctpBridge.address, feeTokenAmount);
      });

      it('Success: should transfer accumulated fee to the owner', async () => {
        await expect(() =>
          cctpBridge.withdrawFeeInTokens(),
        ).to.changeTokenBalance(token, owner, feeTokenAmount);
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          cctpBridge.connect(user).withdrawFeeInTokens(),
        ).to.be.revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('#setAdminFeeShare', () => {
      const newAdminFeeShareBp = 1000;
      it('Success: should set new adminFeeShareBp', async () => {
        await cctpBridge.setAdminFeeShare(newAdminFeeShareBp);
        const actual = await cctpBridge.adminFeeShareBP();
        expect(actual).to.equal(newAdminFeeShareBp);
      });

      it('Failure: should revert when the new fee is more than 100%', async () => {
        await expect(cctpBridge.setAdminFeeShare(10001)).to.be.revertedWith(
          'Too high',
        );
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          cctpBridge.connect(user).setAdminFeeShare(newAdminFeeShareBp),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });
  });
});
