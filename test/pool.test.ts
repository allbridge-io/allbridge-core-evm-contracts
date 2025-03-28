import { expect } from 'chai';
import { ethers } from 'hardhat';
import { parseUnits } from 'ethers/lib/utils';
import { BigNumber, BigNumberish } from 'ethers';
import { Pool, TestBridgeForSwap, Token } from '../typechain';
import { addressToBase32, SP } from './utils';
import { mine } from '@nomicfoundation/hardhat-network-helpers';


describe('Pool', () => {
  let swap: TestBridgeForSwap;
  let tokenA: Token;
  let tokenB: Token;
  let poolA: Pool;
  let poolB: Pool;
  let alice: string;
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

  async function setupContracts(params: {
    balanceRatioMinBP: number;
    balanceDiffChangePerBlock: number;
  } = { balanceRatioMinBP: 1, balanceDiffChangePerBlock: 100000000000 }) {
    const SwapContract = await ethers.getContractFactory('TestBridgeForSwap');
    const TokenContract = await ethers.getContractFactory('Token');
    const PoolContract = await ethers.getContractFactory('Pool');
    alice = (await ethers.getSigners())[0].address;
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
      params.balanceRatioMinBP,
      params.balanceDiffChangePerBlock,
      'aLP',
      'aLP',
    )) as any;
    poolB = (await PoolContract.deploy(
      bob,
      20,
      tokenB.address,
      0,
      params.balanceRatioMinBP,
      params.balanceDiffChangePerBlock,
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
  }

  describe('Pool swap', () => {
    beforeEach(async () => {
      await setupContracts();
    });

    describe('adjustTotalLpAmount', () => {
      beforeEach(async () => {
        const initialDeposit = (1_000_000_000).toString();
        await poolA.deposit(parseUnits(initialDeposit, AP));
        await poolB.deposit(parseUnits(initialDeposit, BP));
      });

      it('zero diff', async () => {
        const totalLpAmountBefore = await poolA.totalSupply();
        await poolA.adjustTotalLpAmount();
        expect(+(await poolA.totalSupply())).closeTo(+totalLpAmountBefore, 1);
        expect(await poolA.d()).eq(await poolA.totalSupply());
      });

      it('Success: adjustTotalLpAmount', async () => {
        const initOwnerLpAmount = await poolA.balanceOf(alice);
        await doSwap(parseUnits('50000000', AP), poolA, poolB, bob);
        await poolA
          .connect(await ethers.getSigner(bob))
          .deposit(parseUnits('50000000', AP));
        const bobLpAmount = await poolA.balanceOf(bob);
        await poolA.connect(await ethers.getSigner(bob)).withdraw(bobLpAmount);
        const totalLpAmountBefore = await poolA.totalSupply();
        expect(+totalLpAmountBefore).lt(+(await poolA.d()));
        await poolA.adjustTotalLpAmount();
        const totalLpAmountAfter = await poolA.totalSupply();
        const d = await poolA.d();
        expect(totalLpAmountAfter).eq(d);
        const ownerLpAmount = await poolA.balanceOf(alice);
        expect(ownerLpAmount.sub(initOwnerLpAmount)).eq(
          d.sub(totalLpAmountBefore),
        );
      });

      it('Failure: not owner', async () => {
        await expect(
          poolA.connect(await ethers.getSigner(bob)).adjustTotalLpAmount(),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('Admin methods', () => {
      describe('deposit', () => {
        it('Success: startDeposit', async () => {
          await poolA.startDeposit();
          expect(await poolA.canDeposit()).eq(1);
        });

        it('Failure: startDeposit should revert when the caller is not the owner', async () => {
          // given bob is the stopAuthority
          await poolA.setStopAuthority(bob);

          await expect(
            poolA.connect(await ethers.getSigner(bob)).startDeposit(),
          ).revertedWith('Ownable: caller is not the owner');
        });

        it('Success: stopDeposit', async () => {
          // given bob is the stopAuthority
          await poolA.setStopAuthority(bob);

          await poolA.connect(await ethers.getSigner(bob)).stopDeposit();
          expect(await poolA.canDeposit()).eq(0);
        });

        it('Failure: stopDeposit should revert when the is not stopAuthority', async () => {
          await expect(
            poolA.connect(await ethers.getSigner(bob)).stopDeposit(),
          ).revertedWith('Pool: is not stopAuthority');
        });

        it('Failure: deposit should revert when deposits are prohibited', async () => {
          // given depositing is stopped
          await poolA.stopDeposit();

          await expect(poolA.deposit(parseUnits('10', AP))).revertedWith(
            'Pool: deposit prohibited',
          );
        });
      });

      describe('withdraw', () => {
        it('Success: startWithdraw', async () => {
          await poolA.startWithdraw();
          expect(await poolA.canWithdraw()).eq(1);
        });

        it('Failure: startWithdraw should revert when the caller is not the owner', async () => {
          // given bob is the stopAuthority
          await poolA.setStopAuthority(bob);

          await expect(
            poolA.connect(await ethers.getSigner(bob)).startWithdraw(),
          ).revertedWith('Ownable: caller is not the owner');
        });

        it('Success: stopWithdraw', async () => {
          // given bob is the stopAuthority
          await poolA.setStopAuthority(bob);

          await poolA.connect(await ethers.getSigner(bob)).stopWithdraw();
          expect(await poolA.canWithdraw()).eq(0);
        });

        it('Failure: stopWithdraw should revert when the is not stopAuthority', async () => {
          await expect(
            poolA.connect(await ethers.getSigner(bob)).stopWithdraw(),
          ).revertedWith('Pool: is not stopAuthority');
        });

        it('Failure: withdraw should revert when withdraws are prohibited', async () => {
          // given withdraws are stopped
          await poolA.stopWithdraw();

          await expect(poolA.withdraw(parseUnits('10', SP))).revertedWith(
            'Pool: withdraw prohibited',
          );
        });
      });

      describe('setStopAuthority', () => {
        it('Success: should update stopAuthority', async () => {
          await poolA.setStopAuthority(bob);
        });

        it('Failure: should revert when the caller is not the owner', async () => {
          await expect(
            poolA.connect(await ethers.getSigner(bob)).setStopAuthority(bob),
          ).revertedWith('Ownable: caller is not the owner');
        });
      });
    });
  });

  describe('Pool balance', () => {
    beforeEach(async () => {
      await setupContracts({
        balanceRatioMinBP: 500,
        balanceDiffChangePerBlock: 1000,
      });

      await poolB.deposit(parseUnits((1_000_000_000).toString(), BP));
      await poolB.setBalanceRatioMinBP(500);

      await poolA.deposit(parseUnits((50_000).toString(), AP));
      await poolA.setBalanceRatioMinBP(500);
    });

    it('should revert when disbalanced', async () => {
      await expect( doSwap(parseUnits('25000', AP), poolA, poolB, bob) ).revertedWith(
        'Pool: low vUSD balance',
      );
    });

    it('should revert when disbalanced 1 block after deposit', async () => {
      await poolA.deposit(parseUnits((50_000).toString(), AP));

      const maxBalanceDiffOld = await poolA.maxBalanceDiffOld();
      const maxBalanceDiff = await poolA.maxBalanceDiff();
      expect(maxBalanceDiffOld.lt(maxBalanceDiff)).to.eq(true);

      await expect( doSwap(parseUnits('25000', AP), poolA, poolB, bob) ).revertedWith(
        'Pool: low vUSD balance',
      );
    });

    it('should be OK when disbalanced 100 blocks after deposit', async () => {
      await poolA.deposit(parseUnits((50_000).toString(), AP));

      await mine(100);

      await expect( doSwap(parseUnits('25000', AP), poolA, poolB, bob) ).revertedWith(
        'Pool: low vUSD balance',
      );
    });

    it('should revert when maxBalanceDiff decreased', async () => {
      // increase maxBalanceDiff
      await poolA.deposit(parseUnits((50_000).toString(), AP));
      await mine(1000);
      // decrease maxBalanceDiff
      await poolA.withdraw(parseUnits((50_000).toString(), SP));

      const maxBalanceDiffOld = await poolA.maxBalanceDiffOld();
      const maxBalanceDiff = await poolA.maxBalanceDiff();
      expect(maxBalanceDiffOld.eq(maxBalanceDiff)).to.eq(true);

      await expect( doSwap(parseUnits('25000', AP), poolA, poolB, bob) ).revertedWith(
        'Pool: low vUSD balance',
      );
    });
  });
});
