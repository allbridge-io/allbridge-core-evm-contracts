import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Pool, ReentrancyToken } from '../typechain';
import { SP } from './utils';

const { parseUnits } = ethers.utils;

describe('Reentrancy attack test', () => {
  let token: ReentrancyToken;
  let pool: Pool;
  let alice: string;
  let bob: string;
  let owner: string;
  let rebalancer: string;

  // Token A precision
  const AP: number = 18;

  let alicePool: Pool;
  let bobPool: Pool;
  let ownerPool: Pool;
  const amount = (amount: string) => parseUnits(amount, AP);
  const amountSP = (amount: string) => parseUnits(amount, SP);

  beforeEach(async () => {
    const TokenContract = await ethers.getContractFactory('ReentrancyToken');
    const PoolContract = await ethers.getContractFactory('Pool');
    alice = (await ethers.getSigners())[0].address;
    bob = (await ethers.getSigners())[1].address;
    owner = (await ethers.getSigners())[2].address;
    rebalancer = (await ethers.getSigners())[3].address;

    token = (await TokenContract.deploy(
      'A',
      'A',
      parseUnits('100000000000000000000'),
      AP,
    )) as any;

    pool = (await PoolContract.deploy(
      owner,
      20,
      token.address,
      2000,
      0,
      'aLP',
      'aLP',
    )) as any;

    await token.approve(pool.address, parseUnits('100000000000000000000', AP));

    await token
      .connect(await ethers.getSigner(rebalancer))
      .approve(pool.address, parseUnits('100000000000000000000', AP));

    await token
      .connect(await ethers.getSigner(alice))
      .approve(pool.address, parseUnits('100000000000000000000', AP));

    await token
      .connect(await ethers.getSigner(bob))
      .approve(pool.address, parseUnits('100000000000000000000', AP));

    await token
      .connect(await ethers.getSigner(owner))
      .approve(pool.address, parseUnits('100000000000000000000', AP));

    await token.transfer(rebalancer, parseUnits('1000000000', AP));
    await token.transfer(alice, parseUnits('1000000000', AP));
    await token.transfer(bob, parseUnits('1000000000', AP));
    await token.transfer(owner, parseUnits('1000000000', AP));
    await token.transfer(token.address, parseUnits('1000000000', AP));
    await pool.transferOwnership(owner);

    alicePool = pool.connect(await ethers.getSigner(alice));
    bobPool = pool.connect(await ethers.getSigner(bob));
    ownerPool = pool.connect(await ethers.getSigner(owner));
    await token.setPool(pool.address);
    await ownerPool.setAdminFeeShare(5000);
  });

  it.skip('Deposit reentrancy without handling', async () => {
    await bobPool.deposit(amount('100'));

    const balanceBefore = await token.balanceOf(alice);
    await alicePool.deposit(amount('100'));
    await token.useAttack(true);
    await alicePool.deposit(amount('100'));
    await token.useAttack(false);
    await alicePool.withdraw(amountSP('200'));
    const balanceAfter = await token.balanceOf(alice);
    expect(balanceAfter.sub(balanceBefore).toString()).eq(amount('50'));
  });

  it('Deposit reentrancy', async () => {
    await token.useAttack(true);
    await expect(bobPool.deposit(amount('100'))).revertedWith(
      'ReentrancyGuard: reentrant call',
    );
  });

  it('Withdraw reentrancy', async () => {
    await alicePool.deposit(amount('200'));
    await token.useAttack(true);
    await expect(bobPool.deposit(amount('100'))).revertedWith(
      'ReentrancyGuard: reentrant call',
    );
  });
  // swapToVUsd does not call any transfer method, so there is no test for it

  it('swapFromVUsd reentrancy', async () => {
    await alicePool.deposit(amount('200'));
    await token.useAttack(true);
    await expect(
      ownerPool.swapFromVUsd(alice, amountSP('100'), 0, true),
    ).revertedWith('ReentrancyGuard: reentrant call');
  });
  it('adjustTotalLpAmount reentrancy', async () => {
    await bobPool.deposit(amount('200'));
    await ownerPool.deposit(amount('200'));
    await ownerPool.swapToVUsd(bob, amount('200'), false);
    await bobPool.withdraw(amountSP('100'));
    await token.useAttack(true);
    await expect(ownerPool.adjustTotalLpAmount()).revertedWith(
      'ReentrancyGuard: reentrant call',
    );
  });
  it('claimRewards reentrancy', async () => {
    await alicePool.deposit(amount('200'));
    await ownerPool.swapToVUsd(bob, amount('200'), false);
    await token.useAttack(true);
    await expect(alicePool.claimRewards()).revertedWith(
      'ReentrancyGuard: reentrant call',
    );
  });
  it('claimAdminFee reentrancy', async () => {
    await alicePool.deposit(amount('200'));
    await ownerPool.swapToVUsd(bob, amount('200'), false);
    await token.useAttack(true);
    await expect(ownerPool.claimAdminFee()).revertedWith(
      'ReentrancyGuard: reentrant call',
    );
  });
});
