import { expect } from 'chai';
import { ethers } from 'hardhat';
import { parseUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from 'ethers';
import { Pool, TestBridgeForSwap, Token } from '../typechain';
import { addressToBase32, SP } from '../test/utils';
import { randomBool, randomNumber } from './utils';

describe('Pool: random walk', () => {
  let swap: TestBridgeForSwap;
  let tokenA: Token;
  let tokenB: Token;
  let poolA: Pool;
  let poolB: Pool;
  let bob: string;

  const AP: number = 18;
  const BP: number = 6;

  const doSwap = async (
    amount: BigNumberish,
    from: Pool,
    to: Pool,
    user: string,
  ) => {
    // router transfers tokens from user to the source pool
    const userSigner = await ethers.getSigner(user);
    const tokenAddress = await from.token();
    const token = await ethers.getContractAt('Token', tokenAddress, userSigner);
    await token.transfer(from.address, amount);

    const vUsdAmount = await from
      .connect(userSigner)
      .swapToVUsd(user, amount, false)
      .then((contractTx) => contractTx.wait())
      .then(
        (v) =>
          v.events!.find((event: any) => event.event === 'SwappedToVUsd')!
            .args![3] as BigNumber,
      );

    await to
      .connect(await ethers.getSigner(user))
      .swapFromVUsd(user, vUsdAmount, 0, false);
  };

  const skipThisIteration = (y: number) => y < 0.3 || y > 3;

  beforeEach(async () => {
    const SwapContract = await ethers.getContractFactory('TestBridgeForSwap');
    const TokenContract = await ethers.getContractFactory('Token');
    const PoolContract = await ethers.getContractFactory('Pool');
    bob = (await ethers.getSigners())[1].address;

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
      bob,
      20,
      tokenA.address,
      0,
      1,
      'aLP',
      'aLP',
    )) as any;
    poolB = (await PoolContract.deploy(
      bob,
      20,
      tokenB.address,
      0,
      1,
      'bLp',
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
    await tokenA.transfer(bob, parseUnits('1000000000', AP));
    await tokenB.transfer(bob, parseUnits('1000000000', BP));

    const baseDeposit = (1_000_000_000).toString();

    await poolA.deposit(parseUnits(baseDeposit, AP));
    await poolB.deposit(parseUnits(baseDeposit, BP));
  });

  it('Random walk test', async () => {
    const initPoolATokenBalance = await poolA.tokenBalance();
    const initPoolBTokenBalance = await poolB.tokenBalance();

    const initPoolAVUsd = await poolA.vUsdBalance();
    const initPoolBVUsd = await poolB.vUsdBalance();

    const initPoolATotalBalance = initPoolATokenBalance.add(initPoolAVUsd);
    const initPoolBTotalBalance = initPoolBTokenBalance.add(initPoolBVUsd);

    await tokenA.transfer(bob, parseUnits('1000000000000000000', AP));
    await tokenB.transfer(bob, parseUnits('1000000000000000000', BP));

    for (let i = 0; i < 100; i++) {
      const swapFromA = randomBool();

      const randomWalkStepAmount = randomNumber(
        200_000_000,
        500_000_000,
      ).toString();
      const amountSP = parseUnits(randomWalkStepAmount, SP);
      const swapAmount = parseUnits(randomWalkStepAmount, swapFromA ? AP : BP);

      const fromPool = swapFromA ? poolA : poolB;
      const toPool = swapFromA ? poolB : poolA;
      const initPool = swapFromA
        ? initPoolATokenBalance
        : initPoolBTokenBalance;

      const fromPoolTokenBalance = await fromPool.tokenBalance();
      const y = +initPool / (+fromPoolTokenBalance + +amountSP);
      console.log(
        `${
          swapFromA ? 'swapFromA' : 'swapFromB'
        }, y = ${y.toString()}, is skipped: ${skipThisIteration(y)}`,
      );

      if (skipThisIteration(y)) continue;

      await doSwap(swapAmount, fromPool, toPool, bob);
    }

    const poolATokenBalance = await poolA.tokenBalance();
    const poolBTokenBalance = await poolB.tokenBalance();
    console.log(
      +initPoolATokenBalance / +poolATokenBalance,
      +initPoolBTokenBalance / +poolBTokenBalance,
    );

    const poolADiffRaw = poolATokenBalance.sub(initPoolATokenBalance);
    const poolBDiffRaw = poolBTokenBalance.sub(initPoolBTokenBalance);

    const poolADiff = poolADiffRaw.abs();
    const poolBDiff = poolBDiffRaw.abs();

    const lastSwapWasA2B = poolADiffRaw.gt(0);

    const fromPool = lastSwapWasA2B ? poolB : poolA;
    const toPool = lastSwapWasA2B ? poolA : poolB;
    const decimals = lastSwapWasA2B ? BP : AP;
    const poolDiff = lastSwapWasA2B ? poolBDiff : poolADiff;

    await doSwap(
      poolDiff.mul(BigNumber.from(10).pow(decimals - 3)),
      fromPool,
      toPool,
      bob,
    );

    const poolATokenBalanceAfterFinalSwap = await poolA.tokenBalance();
    const poolBTokenBalanceAfterFinalSwap = await poolB.tokenBalance();

    const poolAVUsdAfterFinalSwap = await poolA.vUsdBalance();
    const poolBVUsdAfterFinalSwap = await poolB.vUsdBalance();

    const poolATotalBalanceAfterFinalSwap = poolATokenBalanceAfterFinalSwap.add(
      poolAVUsdAfterFinalSwap,
    );
    const poolBTotalBalanceAfterFinalSwap = poolBTokenBalanceAfterFinalSwap.add(
      poolBVUsdAfterFinalSwap,
    );

    expect(poolATotalBalanceAfterFinalSwap).gte(initPoolATotalBalance);
    expect(poolBTotalBalanceAfterFinalSwap).gte(initPoolBTotalBalance);
  });

});
