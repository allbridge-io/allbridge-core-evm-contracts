import { ethers } from 'hardhat';
import chai, { expect } from 'chai';
import { XReserveBridge, Token, IXReserve } from '../typechain';
import { parseUnits } from 'ethers/lib/utils';
import { FakeContract, smock } from '@defi-wonderland/smock';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

chai.use(smock.matchers);

describe('XReserveBridge', () => {
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let token: Token;
  let bridge: XReserveBridge;
  let mockedXReserve: FakeContract<IXReserve>;

  const chainId = 1;
  const tokenPrecision = 6;
  const otherChainId = 2;
  const otherDomain = 100;

  beforeEach(async () => {
    [owner, user] = await ethers.getSigners();

    token = (await ethers.deployContract('Token', [
      'Test USDC',
      'USDC',
      parseUnits('1000000', tokenPrecision),
      tokenPrecision,
    ])) as Token;

    mockedXReserve = await smock.fake<IXReserve>('IXReserve');

    bridge = (await ethers.deployContract('XReserveBridge', [
      chainId,
      token.address,
      mockedXReserve.address,
    ])) as XReserveBridge;

    await bridge.registerBridgeDestination(otherChainId, otherDomain);
  });

  describe('Constructor', () => {
    it('should set correct initial values', async () => {
      expect(await bridge.chainId()).to.equal(chainId);
      expect(await bridge.owner()).to.equal(owner.address);
      expect(await bridge.adminFeeShareBP()).to.equal(0);
      expect(await bridge.maxFeeShare()).to.equal(0);
    });

    it('should approve xReserve to spend tokens', async () => {
      expect(
        await token.allowance(bridge.address, mockedXReserve.address),
      ).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe('bridge', () => {
    let amount: any;
    let recipient: any;

    beforeEach(async () => {
      amount = parseUnits('100', tokenPrecision);
      recipient = ethers.utils.hexZeroPad(user.address, 32).toLowerCase();
      await token.transfer(user.address, amount.mul(2));
      await token
        .connect(user)
        .approve(bridge.address, ethers.constants.MaxUint256);
    });

    it('should bridge tokens without admin fee', async () => {
      const expectedMaxFee = 1; // (amount * 0) / 1e9 + 1

      await expect(bridge.connect(user).bridge(amount, recipient, otherChainId))
        .to.emit(bridge, 'XReserveTokensSent')
        .withArgs(
          user.address,
          recipient,
          amount,
          otherChainId,
          0,
          expectedMaxFee,
        );

      expect(mockedXReserve.depositToRemote).to.have.been.calledWith(
        amount,
        otherDomain,
        recipient.toLowerCase(),
        token.address,
        expectedMaxFee,
        '0x',
      );
    });

    it('should bridge tokens with admin fee', async () => {
      const adminFeeBP = 100; // 1%
      await bridge.setAdminFeeShare(adminFeeBP);

      const adminFee = amount.mul(adminFeeBP).div(10000);
      const amountToSend = amount.sub(adminFee);
      const expectedMaxFee = 1;

      await expect(bridge.connect(user).bridge(amount, recipient, otherChainId))
        .to.emit(bridge, 'XReserveTokensSent')
        .withArgs(
          user.address,
          recipient,
          amount,
          otherChainId,
          adminFee,
          expectedMaxFee,
        );

      expect(mockedXReserve.depositToRemote).to.have.been.calledWith(
        amountToSend,
        otherDomain,
        recipient.toLowerCase(),
        token.address,
        expectedMaxFee,
        '0x',
      );
    });

    it('should bridge tokens with minimum admin fee (1 unit)', async () => {
      const adminFeeBP = 1; // 0.01%
      await bridge.setAdminFeeShare(adminFeeBP);

      const tinyAmount = 100; // Very small amount
      const adminFee = 1; // (100 * 1) / 10000 = 0.01 -> should be 1
      const expectedMaxFee = 1;

      await expect(
        bridge.connect(user).bridge(tinyAmount, recipient, otherChainId),
      )
        .to.emit(bridge, 'XReserveTokensSent')
        .withArgs(
          user.address,
          recipient,
          tinyAmount,
          otherChainId,
          adminFee,
          expectedMaxFee,
        );
    });

    it('should bridge tokens with max fee share', async () => {
      const maxFeeShare = 1e7; // 1% of MAX_FEE_SHARE_P (1e9)
      await bridge.setMaxFeeShare(maxFeeShare);

      const expectedMaxFee = amount.mul(maxFeeShare).div(1e9).add(1);

      await expect(bridge.connect(user).bridge(amount, recipient, otherChainId))
        .to.emit(bridge, 'XReserveTokensSent')
        .withArgs(
          user.address,
          recipient,
          amount,
          otherChainId,
          0,
          expectedMaxFee,
        );

      expect(mockedXReserve.depositToRemote).to.have.been.calledWith(
        amount,
        otherDomain,
        recipient.toLowerCase(),
        token.address,
        expectedMaxFee,
        '0x',
      );
    });

    it('should revert if amount is zero', async () => {
      await expect(
        bridge.connect(user).bridge(0, recipient, otherChainId),
      ).to.be.revertedWith('XRB: Amount must be greater than zero');
    });

    it('should revert if recipient is zero', async () => {
      await expect(
        bridge
          .connect(user)
          .bridge(amount, ethers.constants.HashZero, otherChainId),
      ).to.be.revertedWith('XRB: Recipient must be nonzero');
    });

    it('should revert if chainId is unknown', async () => {
      const unknownChainId = 999;
      await expect(
        bridge.connect(user).bridge(amount, recipient, unknownChainId),
      ).to.be.revertedWith('XRB: Unknown chain id');
    });
  });

  describe('Admin functions', () => {
    it('should register and unregister bridge destination', async () => {
      const newChainId = 3;
      const newDomain = 300;

      await bridge.registerBridgeDestination(newChainId, newDomain);
      expect(await bridge.getDomainByChainId(newChainId)).to.equal(newDomain);

      await bridge.unregisterBridgeDestination(newChainId);
      await expect(bridge.getDomainByChainId(newChainId)).to.be.revertedWith(
        'XRB: Unknown chain id',
      );
    });

    it('should set admin fee share', async () => {
      const newFeeShare = 500;
      await bridge.setAdminFeeShare(newFeeShare);
      expect(await bridge.adminFeeShareBP()).to.equal(newFeeShare);

      await expect(bridge.setAdminFeeShare(10001)).to.be.revertedWith(
        'XRB: Too high',
      );
    });

    it('should set max fee share', async () => {
      const newMaxFeeShare = 1e8;
      await bridge.setMaxFeeShare(newMaxFeeShare);
      expect(await bridge.maxFeeShare()).to.equal(newMaxFeeShare);

      await expect(bridge.setMaxFeeShare(1e9 + 1)).to.be.revertedWith(
        'XRB: Too high',
      );
    });

    it('should withdraw fee in tokens', async () => {
      const feeAmount = parseUnits('10', tokenPrecision);
      await token.transfer(bridge.address, feeAmount);

      const initialOwnerBalance = await token.balanceOf(owner.address);
      await bridge.withdrawFeeInTokens();
      const finalOwnerBalance = await token.balanceOf(owner.address);

      expect(finalOwnerBalance.sub(initialOwnerBalance)).to.equal(feeAmount);
      expect(await token.balanceOf(bridge.address)).to.equal(0);
    });

    it('should not withdraw if balance is zero', async () => {
      const initialOwnerBalance = await token.balanceOf(owner.address);
      await bridge.withdrawFeeInTokens();
      const finalOwnerBalance = await token.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance);
    });

    it('should restrict admin functions to owner', async () => {
      await expect(
        bridge.connect(user).registerBridgeDestination(3, 300),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        bridge.connect(user).unregisterBridgeDestination(otherChainId),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(
        bridge.connect(user).setAdminFeeShare(100),
      ).to.be.revertedWith('Ownable: caller is not the owner');
      await expect(bridge.connect(user).setMaxFeeShare(100)).to.be.revertedWith(
        'Ownable: caller is not the owner',
      );
      await expect(
        bridge.connect(user).withdrawFeeInTokens(),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Fallback and Receive', () => {
    it('should revert on fallback', async () => {
      await expect(user.sendTransaction({ to: bridge.address, data: '0x1234' }))
        .to.be.reverted;
    });

    it('should revert on receive', async () => {
      await expect(user.sendTransaction({ to: bridge.address, value: 1 })).to.be
        .reverted;
    });
  });
});
