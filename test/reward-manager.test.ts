import { ethers } from 'hardhat';
import { TestPoolForRewards, Token } from '../typechain';
import { expect } from 'chai';
import { BigNumber } from 'ethers';

const { parseUnits } = ethers.utils;

describe('Reward manager', () => {
  const P = BigNumber.from('4503599627370496'); // 2^52
  let token: Token;

  let rewardManager: TestPoolForRewards;
  let alice: string;
  let bob: string;

  beforeEach(async function () {
    const TokenContract = await ethers.getContractFactory('Token');
    const TestPoolForRewardsContract = await ethers.getContractFactory(
      'TestPoolForRewards',
    );
    token = (await TokenContract.deploy(
      'A',
      'A',
      parseUnits('10000'),
      18,
    )) as any;

    rewardManager = (await TestPoolForRewardsContract.deploy(
      token.address,
    )) as any;

    alice = (await ethers.getSigners())[0].address;
    bob = (await ethers.getSigners())[1].address;
    await token.transfer(rewardManager.address, parseUnits('10000'));
  });

  it('Success: common flow', async () => {
    {
      // Alice added liquidity
      await rewardManager.deposit(parseUnits('100'));
      expect(await rewardManager.balanceOf(alice)).equal(parseUnits('100'));
      expect(await rewardManager.userRewardDebt(alice)).equal(parseUnits('0'));
      expect(await rewardManager.totalSupply()).equal(parseUnits('100'));
    }

    {
      // Added rewards
      await rewardManager.addRewards(parseUnits('100'));
      expect(await rewardManager.accRewardPerShareP()).equal(
        P.mul(1).mul(80).div(100),
      ); // -20% admin fee
    }

    {
      // Bob added liquidity
      await rewardManager
        .connect(await ethers.getSigner(bob))
        .deposit(parseUnits('100'));
      expect(await rewardManager.balanceOf(bob)).equal(parseUnits('100'));
      expect(await rewardManager.userRewardDebt(bob)).closeTo(
        parseUnits('100').mul(80).div(100), // -20% admin fee
        100000,
      );
      expect(await rewardManager.totalSupply()).equal(parseUnits('200'));
    }

    {
      // Added rewards
      await rewardManager.addRewards(parseUnits('100'));
      expect(await rewardManager.accRewardPerShareP()).closeTo(
        P.mul(15).div(10).mul(80).div(100),
        2,
      ); // 1.5, -20% admin fee
    }

    {
      // Alice claimed rewards
      await rewardManager.claimRewards();
      const rewardBalance = await token.balanceOf(alice);
      expect(rewardBalance).closeTo(parseUnits('150').mul(80).div(100), 100000); // -20% admin fee
      expect(await rewardManager.balanceOf(alice)).equal(parseUnits('100'));
      expect(await rewardManager.userRewardDebt(alice)).closeTo(
        parseUnits('150').mul(80).div(100),
        100000,
      ); // -20% admin fee
    }

    {
      // Bob claimed rewards
      await rewardManager
        .connect(await ethers.getSigner(bob))
        .withdraw(parseUnits('0'));
      const rewardBalance = await token.balanceOf(bob);
      expect(rewardBalance).closeTo(parseUnits('50').mul(80).div(100), 100000); // -20% admin fee
      expect(await rewardManager.balanceOf(bob)).equal(parseUnits('100'));
      expect(await rewardManager.userRewardDebt(bob)).closeTo(
        parseUnits('150').mul(80).div(100),
        100000,
      ); // -20% admin fee
    }

    {
      // Added rewards
      await rewardManager.addRewards(parseUnits('100'));
      expect(await rewardManager.accRewardPerShareP()).closeTo(
        P.mul(20).div(10).mul(80).div(100),
        10,
      ); // 2, -20% admin fee
    }

    {
      // Added rewards
      await rewardManager.addRewards(parseUnits('100'));
      expect(await rewardManager.accRewardPerShareP()).closeTo(
        P.mul(25).div(10).mul(80).div(100),
        10,
      ); // 2.5, -20% admin fee
    }

    {
      // Alice withdraw liquidity
      await rewardManager.withdraw(parseUnits('100'));
      const rewardBalance = await token.balanceOf(alice);
      expect(rewardBalance).closeTo(parseUnits('250').mul(80).div(100), 100000); // + 100, -20% admin fee
      expect(await rewardManager.balanceOf(alice)).equal(parseUnits('0'));
      expect(await rewardManager.userRewardDebt(alice)).equal(parseUnits('0'));
    }

    {
      // Added rewards
      await rewardManager.addRewards(parseUnits('100'));
      expect(await rewardManager.accRewardPerShareP()).closeTo(
        P.mul(35).div(10).mul(80).div(100),
        10,
      ); // 3.5, -20% admin fee
    }

    {
      // Bob withdraw half liquidity
      await rewardManager
        .connect(await ethers.getSigner(bob))
        .withdraw(parseUnits('50'));
      const rewardBalance = await token.balanceOf(bob);
      expect(rewardBalance).closeTo(parseUnits('250').mul(80).div(100), 100000); // + 200, -20% admin fee
      expect(await rewardManager.balanceOf(bob)).equal(parseUnits('50'));
      expect(await rewardManager.userRewardDebt(bob)).closeTo(
        parseUnits('175').mul(80).div(100),
        100000,
      ); // -20% admin fee
    }

    {
      // Withdraw admin fee
      const balanceBefore = await token.balanceOf(alice);
      await rewardManager.claimAdminFee();
      const balanceAfter = await token.balanceOf(alice);
      expect(balanceAfter.sub(balanceBefore)).equal(
        parseUnits('100').mul(5).mul(20).div(100),
      );
    }
  });

  it('Success: admin fee math', async () => {
    const REWARDS_1 = parseUnits('100');
    const REWARDS_2 = parseUnits('200');

    {
      // Alice added liquidity
      await rewardManager.deposit(parseUnits('100'));
    }

    {
      // Added rewards
      await rewardManager.addRewards(REWARDS_1);
      const REWARDS_PER_SHARE = REWARDS_1.mul(P).div(parseUnits('100'));
      expect(await rewardManager.accRewardPerShareP()).equal(
        REWARDS_PER_SHARE.mul(80).div(100),
      ); // -20% admin fee
    }

    {
      // Bob added liquidity
      await rewardManager
        .connect(await ethers.getSigner(bob))
        .deposit(parseUnits('100'));
      expect(await rewardManager.userRewardDebt(bob)).closeTo(
        REWARDS_1.mul(80).div(100),
        100000,
      ); // -20% admin fee
    }

    {
      // Change admin fee
      await rewardManager.setAdminFeeShare(1000); // 10%
      expect(await rewardManager.accRewardPerShareP()).equal(
        P.mul(1).mul(80).div(100),
      ); // Stays the same
    }

    {
      // Added rewards
      await rewardManager.addRewards(REWARDS_2);
      const REWARDS_PER_SHARE_BEFORE = REWARDS_1.mul(P)
        .div(parseUnits('100'))
        .mul(80)
        .div(100); // -20% admin fee
      const REWARDS_PER_SHARE_ADDED = REWARDS_2.mul(P)
        .div(parseUnits('200'))
        .mul(90)
        .div(100); // -10% admin fee
      expect(await rewardManager.accRewardPerShareP()).equal(
        REWARDS_PER_SHARE_BEFORE.add(REWARDS_PER_SHARE_ADDED),
      );
    }

    {
      // Alice withdraw liquidity
      await rewardManager.withdraw(parseUnits('100'));
      const rewardBalance = await token.balanceOf(alice);
      const REWARDS_1_MINUS_FEE = REWARDS_1.mul(80).div(100);
      const REWARDS_2_MINUS_FEE = REWARDS_2.mul(90).div(100);
      // 100% share in the first reward, 50% share in the second reward (because Bob)
      expect(rewardBalance).closeTo(
        REWARDS_1_MINUS_FEE.add(REWARDS_2_MINUS_FEE.div(2)),
        100000,
      );
    }
  });

  it('Failure: admin fee too high', async () => {
    {
      // Change admin fee
      await expect(rewardManager.setAdminFeeShare(10001)).revertedWith(
        'RewardManager: too high',
      );
    }
  });

  it('Failure: unauthorized admin fee change', async () => {
    {
      // Change admin fee
      await expect(
        rewardManager
          .connect(await ethers.getSigner(bob))
          .setAdminFeeShare(10001),
      ).revertedWith('Ownable: caller is not the owner');
    }
  });

  it('Failure: unauthorized admin fee claim', async () => {
    {
      // Change admin fee
      await expect(
        rewardManager.connect(await ethers.getSigner(bob)).claimAdminFee(),
      ).revertedWith('Ownable: caller is not the owner');
    }
  });

  it('Failure: withdraw too much', async () => {
    {
      // Alice added liquidity
      await rewardManager.deposit(parseUnits('100'));
      // Withdrawing too much
      await expect(
        rewardManager.withdraw(parseUnits('100').add(1)),
      ).revertedWith('RewardManager: not enough amount');
    }
  });

  describe('LP Restriction', () => {
    it('Success: decimals', async () => {
      {
        expect(await rewardManager.decimals()).equal(3);
      }
    });
    it('Failure: transfer', async () => {
      {
        await rewardManager.deposit(parseUnits('100'));
        await expect(rewardManager.transfer(bob, 1)).revertedWith(
          'Unsupported',
        );
      }
    });
    it('Failure: transferFrom', async () => {
      {
        await rewardManager.deposit(parseUnits('100'));
        await expect(rewardManager.transferFrom(alice, bob, 1)).revertedWith(
          'ERC20: insufficient allowance',
        );
      }
    });
    it('Failure: approve', async () => {
      {
        await rewardManager.deposit(parseUnits('100'));
        await expect(rewardManager.approve(bob, 1)).revertedWith('Unsupported');
      }
    });

    it('Failure: increaseAllowance', async () => {
      {
        await rewardManager.deposit(parseUnits('100'));
        await expect(rewardManager.increaseAllowance(bob, 1)).revertedWith(
          'Unsupported',
        );
      }
    });

    it('Failure: decreaseAllowance', async () => {
      {
        await rewardManager.deposit(parseUnits('100'));
        await expect(rewardManager.decreaseAllowance(bob, 1)).revertedWith(
          'ERC20: decreased allowance below zero',
        );
      }
    });
  });
});
