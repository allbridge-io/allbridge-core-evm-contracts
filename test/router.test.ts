import { expect } from 'chai';
import { ethers } from 'hardhat';
import { Pool, TestBridgeForSwap, Token } from '../typechain';
import { BigNumber } from 'ethers';
import { addressToBase32, EPP, ESP, SP } from './utils';

const { AddressZero } = ethers.constants;

const { parseUnits } = ethers.utils;

describe('Router: common flow', () => {
  let swap: TestBridgeForSwap;
  let tokenA: Token;
  let tokenB: Token;
  let poolA: Pool;
  let poolB: Pool;
  let alice: string;
  let bob: string;
  let owner: string;
  let rebalancer: string;

  // Token A precision
  const AP: number = 18;
  const EAP: number = 1e18;

  // Token B precision
  const BP: number = 6;
  const EBP: number = 1e6;

  let alicePoolA: Pool;
  let bobPoolA: Pool;
  let ownerPoolA: Pool;
  const amountA = (amount: string) => parseUnits(amount, AP);
  const amountSP = (amount: string) => parseUnits(amount, SP);

  async function doSwap(
    fromToken: string,
    toToken: string,
    amount: string | BigNumber | number,
    sender: string,
    _recipient?: string,
  ) {
    const recipient = _recipient ?? sender;
    const tx = await swap
      .connect(await ethers.getSigner(sender))
      .swap(
        amount,
        addressToBase32(fromToken),
        addressToBase32(toToken),
        recipient,
        0,
      );
    const txReceipt = await tx.wait();
    const vUsdAmount = txReceipt.events?.find((ev) => ev.event === 'vUsdSent')
      ?.args?.amount;
    console.log('Swap', +vUsdAmount);
  }

  async function logPools() {
    console.log('pairA', {
      tokenBalance: +(await poolA.tokenBalance()) / ESP,
      vUsdBalance: +(await poolA.vUsdBalance()) / ESP,
      D: +(await poolA.d()) / ESP,
    });
    console.log('pairB', {
      tokenBalance: +(await poolB.tokenBalance()) / ESP,
      vUsdBalance: +(await poolB.vUsdBalance()) / ESP,
      D: +(await poolB.d()) / ESP,
    });

    console.log('priceA', +(await poolA.getPrice()) / EPP);
    console.log('priceB', +(await poolB.getPrice()) / EPP);
  }

  async function logUserLp(user: string) {
    console.log('lpABalance', +(await poolA.balanceOf(user)) / ESP);
    console.log('lpBBalance', +(await poolB.balanceOf(user)) / ESP);
  }

  async function logUserTokens(user: string) {
    console.log('userBalance A', +(await tokenA.balanceOf(user)) / EAP);
    console.log('userBalance B', +(await tokenB.balanceOf(user)) / EBP);
  }

  beforeEach(async () => {
    const SwapContract = await ethers.getContractFactory('TestBridgeForSwap');
    const TokenContract = await ethers.getContractFactory('Token');
    const PoolContract = await ethers.getContractFactory('Pool');
    alice = (await ethers.getSigners())[0].address;
    bob = (await ethers.getSigners())[1].address;
    owner = (await ethers.getSigners())[2].address;
    rebalancer = (await ethers.getSigners())[3].address;

    swap = (await SwapContract.deploy()) as any;
    tokenA = (await TokenContract.deploy(
      'A',
      'A',
      parseUnits('100000000000000000000'),
      AP,
    )) as any;
    tokenB = (await TokenContract.deploy(
      'B',
      'B',
      parseUnits('100000000000000000000'),
      BP,
    )) as any;

    poolA = (await PoolContract.deploy(
      swap.address,
      20,
      tokenA.address,
      0,
      0,
      'aLP',
      'aLP',
    )) as any;
    poolB = (await PoolContract.deploy(
      swap.address,
      20,
      tokenB.address,
      0,
      0,
      'bLP',
      'bLP',
    )) as any;
    await swap.addPool(poolA.address, addressToBase32(tokenA.address));
    await swap.addPool(poolB.address, addressToBase32(tokenB.address));
    await tokenA.approve(
      poolA.address,
      parseUnits('100000000000000000000', AP),
    );
    await tokenB.approve(
      poolB.address,
      parseUnits('100000000000000000000', BP),
    );
    await tokenA
      .connect(await ethers.getSigner(bob))
      .approve(poolA.address, parseUnits('100000000000000000000', AP));
    await tokenB
      .connect(await ethers.getSigner(bob))
      .approve(poolB.address, parseUnits('100000000000000000000', BP));
    await tokenA
      .connect(await ethers.getSigner(bob))
      .approve(swap.address, parseUnits('100000000000000000000', AP));
    await tokenB
      .connect(await ethers.getSigner(bob))
      .approve(swap.address, parseUnits('100000000000000000000', BP));
    await tokenA
      .connect(await ethers.getSigner(rebalancer))
      .approve(poolA.address, parseUnits('100000000000000000000', AP));
    await tokenB
      .connect(await ethers.getSigner(rebalancer))
      .approve(poolB.address, parseUnits('100000000000000000000', BP));
    await tokenA
      .connect(await ethers.getSigner(rebalancer))
      .approve(swap.address, parseUnits('100000000000000000000', AP));
    await tokenB
      .connect(await ethers.getSigner(rebalancer))
      .approve(swap.address, parseUnits('100000000000000000000', BP));
    await tokenA
      .connect(await ethers.getSigner(alice))
      .approve(swap.address, parseUnits('100000000000000000000', AP));
    await tokenB
      .connect(await ethers.getSigner(alice))
      .approve(swap.address, parseUnits('100000000000000000000', BP));
    await tokenA.transfer(bob, parseUnits('1000000000', AP));
    await tokenA.transfer(rebalancer, parseUnits('1000000000', AP));
    await swap.transferOwnership(owner);
    await poolA.transferOwnership(owner);
    await poolB.transferOwnership(owner);

    alicePoolA = poolA.connect(await ethers.getSigner(alice));
    bobPoolA = poolA.connect(await ethers.getSigner(bob));
    ownerPoolA = poolA.connect(await ethers.getSigner(owner));
  });

  it('Success: full flow', async () => {
    {
      console.log('Added 200 A Liquidity to pool');
      console.log('Added 200 B Liquidity to pool');
      await poolA.deposit(parseUnits('200', AP));
      await poolB.deposit(parseUnits('200', BP));

      await logPools();
      await logUserLp(alice);

      expect(+(await poolA.getPrice()) / EPP).equal(1);
      expect(+(await poolB.getPrice()) / EPP).equal(1);
      expect(+(await poolA.balanceOf(alice)) / ESP).closeTo(200, 0.01);
      expect(+(await poolB.balanceOf(alice)) / ESP).closeTo(200, 0.01);
      expect(+(await poolA.d()) / ESP).closeTo(200, 0.01);
    }
    console.log();

    {
      console.log('Swap 100 A to B');
      await doSwap(tokenA.address, tokenB.address, parseUnits('100', AP), bob);

      await logPools();
      await logUserTokens(bob);

      expect(+(await tokenA.balanceOf(bob)) / EAP).closeTo(999999900, 0.0001);
      expect(+(await tokenB.balanceOf(bob)) / EBP).closeTo(84.18, 0.01);
      expect(+(await poolA.tokenBalance()) / ESP).equal(200);
      expect(+(await poolA.vUsdBalance()) / ESP).closeTo(10, 0.01);
      expect(+(await poolB.tokenBalance()) / ESP).closeTo(15.82, 0.01);
      expect(+(await poolB.vUsdBalance()) / ESP).closeTo(190, 0.01);
      expect(+(await poolA.getPrice()) / EPP).closeTo(0.4722, 0.01);
      expect(+(await poolB.getPrice()) / EPP).closeTo(1.4618, 0.01);
    }
    console.log();

    {
      console.log('Added 100 A Liquidity to pool');
      console.log('Added 100 B Liquidity to pool');
      await poolA.deposit(parseUnits('100', AP));
      await poolB.deposit(parseUnits('100', BP));

      await logPools();
      await logUserLp(alice);

      // the same balance after deposit
      expect(+(await poolA.getPrice()) / EPP).closeTo(0.4722, 0.01);
      expect(+(await poolB.getPrice()) / EPP).closeTo(1.4618, 0.01);
      expect(+(await poolA.balanceOf(alice)) / ESP).closeTo(295.24, 0.1);
      expect(+(await poolB.balanceOf(alice)) / ESP).closeTo(297.174, 0.1);
      expect(+(await poolA.d()) / ESP).closeTo(295.241, 0.01);
    }
    console.log();

    {
      console.log('Withdraw 200 A Liquidity from pool');
      console.log('Withdraw 200 B Liquidity from pool');
      // Withdraw liquidity works with LP tokens of system precision
      await poolA.withdraw(parseUnits('200', SP));
      await poolB.withdraw(parseUnits('200', SP));

      await logPools();
      await logUserLp(alice);

      // pool is not changed balance after adding liquidity
      expect(+(await poolA.getPrice()) / EPP).closeTo(0.4722, 0.01);
      expect(+(await poolB.getPrice()) / EPP).closeTo(1.4618, 0.01);
      expect(+(await poolA.balanceOf(alice)) / ESP).closeTo(95.24, 0.1); // Exactly 200 LP burned
      expect(+(await poolB.balanceOf(alice)) / ESP).closeTo(97.174, 0.1); // Exactly 200 LP burned
      expect(+(await poolA.d()) / ESP).closeTo(105, 0.3); // Around -50%
    }
    console.log();

    {
      console.log('Swap 44 B to A to balance pool');
      await doSwap(
        tokenB.address,
        tokenA.address,
        parseUnits('44.00', BP),
        bob,
      );

      await logPools();
      await logUserTokens(bob);

      expect(+(await tokenA.balanceOf(bob)) / EAP).closeTo(1000000000, 100);
      expect(+(await tokenB.balanceOf(bob)) / EBP).closeTo(40, 1);

      // We cannot get back to the initial state of total balance after (swap)-(remove liquidity)-(swap back)
      // But we should be close to the initial 100
      expect(+(await poolA.tokenBalance()) / ESP).closeTo(52.4, 0.2);
      expect(+(await poolA.vUsdBalance()) / ESP).closeTo(52.4, 0.2);
      expect(+(await poolB.tokenBalance()) / ESP).closeTo(51.2, 1);
      expect(+(await poolB.vUsdBalance()) / ESP).closeTo(51.2, 1);

      // Prices should be close to 1
      expect(+(await poolA.getPrice()) / EPP).closeTo(1, 0.001);
      expect(+(await poolB.getPrice()) / EPP).closeTo(1, 0.004);
    }
    console.log();

    {
      console.log('Withdraw 99 A Liquidity to pool');
      console.log('Withdraw 99 B Liquidity to pool');
      await poolA.withdraw(parseUnits('95.24', SP));
      await poolB.withdraw(parseUnits('59', SP)); // reserves

      await logPools();
      await logUserLp(alice);

      // Price in 0.98/1.02 range
      expect(+(await poolA.getPrice()) / EPP).closeTo(1, 0.02);
      expect(+(await poolB.getPrice()) / EPP).closeTo(1, 0.02);
      // Exactly All LP burned
      expect(+(await poolA.balanceOf(alice)) / ESP).equal(0);
      // Exactly 59 LP burned
      expect(+(await poolB.balanceOf(alice)) / ESP).equal(38.172);
      expect(+(await poolA.d()) / ESP).closeTo(10, 1);
    }
  });

  it('small amounts', async () => {
    await poolA.deposit(parseUnits('0.20', AP));
    await poolB.deposit(parseUnits('0.20', BP));
    expect(+(await poolA.d()) / ESP)
      .gte(0.2)
      .lte(0.201);
    await logUserLp(alice);

    await doSwap(tokenA.address, tokenB.address, parseUnits('0.10', AP), bob);
    expect(+(await poolA.tokenBalance()) / ESP).equal(0.2);
    expect(+(await poolA.vUsdBalance()) / ESP).equal(0.011);
    expect(+(await tokenB.balanceOf(bob)) / EBP).equal(0.083);
    expect(+(await poolB.tokenBalance()) / ESP).equal(0.017);
    expect(+(await poolB.vUsdBalance()) / ESP).equal(0.189);

    expect(+(await poolA.getPrice()) / EPP).equal(0.4723);
    expect(+(await poolB.getPrice()) / EPP).equal(1.4012);
  });

  it('big amounts', async () => {
    await poolA.deposit(parseUnits('1000000000', AP)); // 0.5B
    await poolB.deposit(parseUnits('1000000000', BP)); // 0.5B
    await doSwap(
      tokenA.address,
      tokenB.address,
      parseUnits('500000000', AP),
      bob,
    ); // 0.5B

    expect(+(await poolA.d()) / ESP).closeTo(1000000000, 2); // 1B
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(1000000000, 1); // 1B
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(50000000, 10); // 0.05B
    expect(+(await tokenB.balanceOf(bob)) / EBP).closeTo(420909000, 50); // 0.42B
    expect(+(await poolB.tokenBalance()) / ESP).closeTo(79090999, 50); // 0.08B
    expect(+(await poolB.vUsdBalance()) / ESP).closeTo(950000000, 50); // 0.95B

    expect(+(await poolA.getPrice()) / EPP).closeTo(0.4722, 0.01);
    expect(+(await poolB.getPrice()) / EPP).closeTo(1.4618, 0.01);
  });

  it('big liquidity small swap', async () => {
    await poolA.deposit(parseUnits('200000000', AP));
    await poolB.deposit(parseUnits('200000000', BP));
    await doSwap(tokenA.address, tokenB.address, parseUnits('1', AP), bob);

    expect(+(await poolA.d()) / ESP).closeTo(200000000, 0.1);
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(100000001, 1);
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(99999999, 1);

    expect(+(await tokenB.balanceOf(bob)) / 1e6).closeTo(1, 0.01);
    expect(+(await poolB.tokenBalance()) / ESP).closeTo(99999999, 1);
    expect(+(await poolB.vUsdBalance()) / ESP).closeTo(100000001, 1);

    expect(+(await poolA.getPrice()) / EPP).closeTo(1, 0.0001);
    expect(+(await poolB.getPrice()) / EPP).closeTo(1, 0.0001);
  });

  it('normal liquidity normal swap', async () => {
    await poolA.deposit(parseUnits('2000000', AP)); // 1M
    await poolB.deposit(parseUnits('2000000', BP)); // 1M

    await doSwap(tokenA.address, tokenB.address, parseUnits('1', AP), bob);
    expect(+(await poolA.d()) / ESP).closeTo(2000000, 1);
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(1000001, 1);
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(999999, 1);

    expect(+(await tokenB.balanceOf(bob)) / EBP).closeTo(1, 0.01);
    expect(+(await poolB.tokenBalance()) / ESP).closeTo(999999, 1);
    expect(+(await poolB.vUsdBalance()) / ESP).closeTo(1000001, 1);

    expect(+(await poolA.getPrice()) / EPP).closeTo(1, 0.0001);
    expect(+(await poolB.getPrice()) / EPP).closeTo(1, 0.0001);
  });

  it('test with fee', async () => {
    await poolA.deposit(parseUnits('2000000', AP)); // 1M
    await poolB.deposit(parseUnits('2000000', BP)); // 1M
    await poolA.connect(await ethers.getSigner(owner)).setFeeShare('100');
    await poolB.connect(await ethers.getSigner(owner)).setFeeShare('200');

    await doSwap(tokenA.address, tokenB.address, parseUnits('1', AP), bob);
    expect(+(await poolA.d()) / ESP).closeTo(2000000, 1);
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(1000000.99, 1);
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(999999, 1);
    expect(+(await tokenA.balanceOf(bob)) / EAP).closeTo(999999999, 1);

    expect(+(await tokenA.balanceOf(poolA.address)) / EAP).closeTo(2000001, 1);

    expect(+(await tokenB.balanceOf(bob)) / EBP).closeTo(
      0.97,
      0.01, // - // - 1% on input, 2% on output ≈ 0.97
    );
    expect(+(await poolA.accRewardPerShareP()) / EAP).closeTo(
      22035 * 0.8, // -20% admin fee
      1000,
    ); // 0.01 * 1e18 * P / 1000000SP
    expect(+(await poolB.accRewardPerShareP()) / EBP).closeTo(
      22035 * 2 * 0.8, // -20% admin fee
      1000,
    ); // ≈ 0.02 * 1e6 * P / 1000000SP
    expect(+(await poolB.tokenBalance()) / ESP).closeTo(999999, 1);
    expect(+(await poolB.vUsdBalance()) / ESP).closeTo(1000000, 1);
  });

  it('test with fee by rebalancer', async () => {
    await poolA.deposit(parseUnits('2000000', AP)); // 1M
    await poolB.deposit(parseUnits('2000000', BP)); // 1M
    await poolA.connect(await ethers.getSigner(owner)).setFeeShare('100');
    await poolB.connect(await ethers.getSigner(owner)).setFeeShare('200');
    await swap.connect(await ethers.getSigner(owner)).setRebalancer(rebalancer);

    await doSwap(
      tokenA.address,
      tokenB.address,
      parseUnits('1', AP),
      rebalancer,
    );
    expect(+(await poolA.d()) / ESP).closeTo(2000000, 1);
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(1000000.99, 1);
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(999999, 1);
    expect(+(await tokenA.balanceOf(rebalancer)) / EAP).closeTo(999999999, 1);

    expect(+(await tokenA.balanceOf(poolA.address)) / EAP).closeTo(2000001, 1);

    expect(+(await tokenB.balanceOf(rebalancer)) / EBP).closeTo(
      1,
      0.01, // ≈ 1
    ); // no fee for rebalancer
    expect(+(await poolA.accRewardPerShareP()) / EAP).eq(0); // no fee for rebalancer
    expect(+(await poolB.accRewardPerShareP()) / EBP).eq(0); // no fee for rebalancer
    expect(+(await poolB.tokenBalance()) / ESP).closeTo(999999, 1);
    expect(+(await poolB.vUsdBalance()) / ESP).closeTo(1000000, 1);
  });

  it('single swap', async () => {
    await poolA.deposit(parseUnits('2000000', AP)); // 1M
    await poolB.deposit(parseUnits('2000000', BP)); // 1M

    const response = await swap
      .connect(await ethers.getSigner(bob))
      .swap(
        parseUnits('1', AP),
        addressToBase32(tokenA.address),
        addressToBase32(tokenB.address),
        bob,
        0,
      );

    await expect(response)
      .emit(swap, 'Swapped')
      .withArgs(
        bob,
        bob,
        addressToBase32(tokenA.address),
        addressToBase32(tokenB.address),
        parseUnits('1', AP),
        parseUnits('0.998000', BP),
      );
    expect(+(await poolA.d()) / ESP).closeTo(2000000, 1);
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(1000001, 1);
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(999999, 1);

    expect(+(await tokenB.balanceOf(bob)) / EBP).closeTo(1, 0.01);
    expect(+(await poolB.tokenBalance()) / ESP).closeTo(999999, 1);
    expect(+(await poolB.vUsdBalance()) / ESP).closeTo(1000001, 1);

    expect(+(await poolA.getPrice()) / EPP).closeTo(1, 0.001);
    expect(+(await poolB.getPrice()) / EPP).closeTo(1, 0.001);
  });

  it('Too big price', async () => {
    await poolA.deposit(parseUnits('2000000', AP)); // 1M
    await poolB.deposit(parseUnits('2000000', BP)); // 1M

    await doSwap(
      tokenA.address,
      tokenB.address,
      parseUnits('10000000', AP),
      bob,
    ); // 10M

    expect(+(await poolA.d()) / ESP).closeTo(2000000, 1);
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(11000000, 1);
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(251.81871, 1);

    expect(+(await tokenB.balanceOf(bob)) / EBP).closeTo(899881, 1);
    expect(+(await poolB.tokenBalance()) / ESP).closeTo(100118, 1);
    expect(+(await poolB.vUsdBalance()) / ESP).closeTo(1999748, 1);

    expect(+(await poolA.getPrice()) / EPP).eq(0.0001);
    expect(+(await poolB.getPrice()) / EPP).closeTo(2.1151, 0.0001);

    await doSwap(tokenA.address, tokenB.address, parseUnits('1', AP), bob);

    expect(+(await poolA.d()) / ESP).closeTo(2000000, 1);
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(11000001, 1);
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(251.81866, 1);

    expect(+(await tokenB.balanceOf(bob)) / EBP).closeTo(899881, 1);
    expect(+(await poolB.tokenBalance()) / ESP).closeTo(100118, 1);
    expect(+(await poolB.vUsdBalance()) / ESP).closeTo(1999748, 1);

    expect(+(await poolA.getPrice()) / EPP).eq(0.0001);
    expect(+(await poolB.getPrice()) / EPP).closeTo(2.1151, 0.0001);
  });

  it('Deposit and immediate withdraw', async () => {
    await poolA.deposit(parseUnits('2000000', AP)); // 1M

    expect(+(await poolA.d()) / ESP).closeTo(2000000, 1);

    await poolA.withdraw(parseUnits('2000000', SP));

    expect(+(await poolA.d()) / ESP).closeTo(0, 1);
    expect(+(await poolA.tokenBalance()) / ESP).closeTo(0, 1);
    expect(+(await poolA.vUsdBalance()) / ESP).closeTo(0, 1);
  });

  it('Withdraw small amount', async () => {
    await poolA.deposit(parseUnits('2000000', AP)); // 1M

    await expect(poolA.withdraw(1)).revertedWith(`zero changes`);
  });

  it('Withdraw with extra balance on the contract', async () => {
    await poolA.deposit(parseUnits('200000', AP)); // 1M
    await tokenA.transfer(poolA.address, parseUnits('100000', AP));

    const balanceBefore = await tokenA.balanceOf(alice);

    await poolA.withdraw(parseUnits('200', SP));
    const balanceAfter = await tokenA.balanceOf(alice);

    expect(balanceAfter.sub(balanceBefore).toString()).eq(
      parseUnits('100200', AP),
    );
  });

  it('Deposit and Withdraw with extra balance on the contract', async () => {
    await alicePoolA.deposit(amountA('200000'));
    await tokenA.transfer(poolA.address, amountA('100000'));

    await bobPoolA.deposit(amountA('200'));

    const balanceBefore = await tokenA.balanceOf(bob);

    await bobPoolA.withdraw(amountSP('200'));
    const balanceAfter = await tokenA.balanceOf(bob);

    expect(balanceAfter.sub(balanceBefore).toString()).eq(
      parseUnits('200', AP),
    );
  });

  it('Add extra amount before swap', async () => {
    await alicePoolA.deposit(amountA('2000'));
    await bobPoolA.deposit(amountA('3000'));

    await tokenA.transfer(poolA.address, amountA('50'));
    await doSwap(tokenA.address, tokenB.address, amountA('100'), alice);

    const aliceBalanceBefore = await tokenA.balanceOf(alice);
    const bobBalanceBefore = await tokenA.balanceOf(bob);

    await alicePoolA.withdraw(amountSP('100'));
    await bobPoolA.withdraw(amountSP('100'));

    await poolA.accRewardPerShareP();

    const aliceBalanceAfter = await tokenA.balanceOf(alice);
    const bobBalanceAfter = await tokenA.balanceOf(bob);

    expect(aliceBalanceAfter.sub(aliceBalanceBefore).toString()).eq(
      amountA('120'),
    );
    expect(bobBalanceAfter.sub(bobBalanceBefore).toString()).eq(amountA('130'));
  });

  it('Add extra amount before claim', async () => {
    await alicePoolA.deposit(amountA('2000'));
    await bobPoolA.deposit(amountA('3000'));

    await tokenA.transfer(poolA.address, amountA('50'));
    await doSwap(tokenA.address, tokenB.address, amountA('100'), alice);

    const aliceBalanceBefore = await tokenA.balanceOf(alice);
    const bobBalanceBefore = await tokenA.balanceOf(bob);

    await alicePoolA.claimRewards();
    await bobPoolA.claimRewards();

    await poolA.accRewardPerShareP();

    const aliceBalanceAfter = await tokenA.balanceOf(alice);
    const bobBalanceAfter = await tokenA.balanceOf(bob);

    expect(aliceBalanceAfter.sub(aliceBalanceBefore).toString()).eq(
      amountA('20'),
    );
    expect(bobBalanceAfter.sub(bobBalanceBefore).toString()).eq(amountA('30'));
  });

  it('Add extra amount before each step', async () => {
    await ownerPoolA.setFeeShare(2000);
    await ownerPoolA.setAdminFeeShare(5000);

    await tokenA.transfer(poolA.address, amountA('5000')); // to nobody
    await alicePoolA.deposit(amountA('2000'));
    await tokenA.transfer(poolA.address, amountA('10')); // 10 to alice
    await bobPoolA.deposit(amountA('3000'));
    await tokenA.transfer(poolA.address, amountA('50')); // 20 to alice, 30 to bob

    await doSwap(tokenA.address, tokenB.address, amountA('100'), alice); // 10 to owner, 4 to alice, 6 to bob
    await tokenA.transfer(poolA.address, amountA('50')); // 20 to alice, 30 to bob

    {
      const user = owner;
      const balanceBefore = await tokenA.balanceOf(user);
      await ownerPoolA.claimAdminFee();
      const balanceAfter = await tokenA.balanceOf(user);
      expect(balanceAfter.sub(balanceBefore).toString()).eq(amountA('10'));
    }

    await tokenA.transfer(poolA.address, amountA('50')); // 20 to alice, 30 to bob

    {
      const user = alice;
      const balanceBefore = await tokenA.balanceOf(user);
      await alicePoolA.claimRewards();
      const balanceAfter = await tokenA.balanceOf(user);
      expect(balanceAfter.sub(balanceBefore).toString()).eq(amountA('74')); // 10 + 20 + 20 + 20 + 4
    }

    await tokenA.transfer(poolA.address, amountA('50')); // 20 to alice, 30 to bob

    {
      const user = bob;
      const balanceBefore = await tokenA.balanceOf(user);
      await bobPoolA.withdraw(amountSP('2000'));
      const balanceAfter = await tokenA.balanceOf(user);
      expect(balanceAfter.sub(balanceBefore).toString()).eq(amountA('2126')); // 30 + 30 + 30 + 30 + 6
    }

    await tokenA.transfer(poolA.address, amountA('30')); // 20 to alice, 10 to bob

    {
      const user = alice;
      const balanceBefore = await tokenA.balanceOf(user);
      await alicePoolA.withdraw(amountSP('1000'));
      const balanceAfter = await tokenA.balanceOf(user);
      expect(balanceAfter.sub(balanceBefore).toString()).eq(amountA('1040')); // 10 + 20 + 20 + 20 + 20 + 20 + 4 - 74
    }
  });

  it('Liquidity add(after)-withdraw(before)', async () => {
    await tokenA
      .connect(await ethers.getSigner(bob))
      .transfer(alice, parseUnits('999999000'));
    await tokenB.transfer(bob, parseUnits('1000'));

    await poolA.deposit(parseUnits('200', AP));
    await poolB.deposit(parseUnits('200', BP));

    await doSwap(tokenA.address, tokenB.address, parseUnits('100', AP), alice);

    const balanceABefore = await tokenA.balanceOf(bob);
    const balanceBBefore = await tokenB.balanceOf(bob);

    await poolA
      .connect(await ethers.getSigner(bob))
      .deposit(parseUnits('200', AP));
    await poolB
      .connect(await ethers.getSigner(bob))
      .deposit(parseUnits('200', BP));

    await logUserLp(bob);

    await poolA
      .connect(await ethers.getSigner(bob))
      .withdraw(parseUnits('190.478', SP));
    await poolB
      .connect(await ethers.getSigner(bob))
      .withdraw(parseUnits('194.346', SP));

    const balanceAAfter = await tokenA.balanceOf(bob);
    const balanceBAfter = await tokenB.balanceOf(bob);

    console.log('balanceABefore', +balanceABefore / EAP);
    console.log('balanceAAfter', +balanceAAfter / EAP);
    console.log('balanceBBefore', +balanceBBefore / EBP);
    console.log('balanceBAfter', +balanceBAfter / EBP);

    expect(+balanceABefore).gte(+balanceAAfter);
    expect(+balanceBBefore).gte(+balanceBAfter);

    expect(+balanceABefore).closeTo(+balanceAAfter, 0.01 * +balanceAAfter);
    expect(+balanceBBefore).closeTo(+balanceBAfter, 0.01 * +balanceBAfter);
  });

  describe('given balanced pools', () => {
    beforeEach(async () => {
      await poolA.deposit(parseUnits('1000000', AP)); // 1M
      await poolB.deposit(parseUnits('1000000', BP)); // 1M
    });

    it('Failure: swap should revert transaction if received less tokens than required', async () => {
      const amount = parseUnits('1', AP);
      const amountBefore = await tokenB.balanceOf(bob);
      await expect(
        swap
          .connect(await ethers.getSigner(bob))
          .swap(
            amount,
            addressToBase32(tokenA.address),
            addressToBase32(tokenB.address),
            bob,
            amount.add(1),
          ),
      ).to.be.revertedWith('Pool: slippage');

      const amountAfter = await tokenB.balanceOf(bob);
      // balance should not change
      await expect(amountAfter).eq(amountBefore);
    });

    it('Failure: swap should revert if sending to zero-address', async () => {
      await expect(
        doSwap(
          tokenA.address,
          tokenB.address,
          parseUnits('1', AP),
          bob,
          AddressZero,
        ),
      ).to.be.revertedWith('transfer to the zero address');
    });
  });
});
