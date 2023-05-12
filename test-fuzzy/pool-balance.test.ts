import { TestBridgeForSwap } from '../typechain';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { PoolData } from './pool-utils/pool-data';
import { TestEnv } from './pool-utils/test-env';
import {
  AdjustTotalLpAmountStep,
  DepositFixedAmountStep,
  DepositPercentOfInitialPoolBalanceStep,
  StepInterface,
  SwapFixedAmountStep,
  SwapPercentOfTokensInPoolStep,
  WithdrawFixedAmountStep,
  WithdrawPercentStep,
} from './pool-utils/step';
import { expect } from 'chai';
import { Strategy } from './pool-utils/strategy';

import { randomNumber } from './utils';

describe('Pool balance', () => {
  let bridge: TestBridgeForSwap;
  let busdData: PoolData;
  let usdtData: PoolData;
  let testEnv: TestEnv;
  let strategy: Strategy;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  before(async () => {
    [owner, user] = await ethers.getSigners();

    const bridgeFactory = await ethers.getContractFactory('TestBridgeForSwap');
    bridge = await bridgeFactory.deploy();
  });

  beforeEach(async () => {
    strategy = new Strategy();
    strategy.beforeRun = async () => {
      strategy.logSteps();
      await testEnv.logPoolsStateWithUsersBalances();
      await testEnv.logUsersTotalAmount();
    };
    strategy.afterStep = async () => {
      await testEnv.logPoolsStateWithUsersBalances();
      await testEnv.logUsersTotalAmount();
    };
    strategy.afterRun = async () => {
      await testEnv.logUsersTotalProfit();
    };
  });

  describe('given one empty pool', () => {
    beforeEach(async () => {
      bridge = bridge.connect(owner);
      busdData = await PoolData.setup('BUSD', bridge, user, 0, 1);
      usdtData = await PoolData.setup('USDT', bridge, user, 1_000_000, 1);

      bridge = bridge.connect(user);
      testEnv = new TestEnv(user, [busdData, usdtData]);
    });

    it('unbalancing should not yield profit 2', async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 50_000),
        new SwapFixedAmountStep(bridge, busdData, usdtData, 45_000),
        new WithdrawPercentStep(busdData, 99),
        new DepositFixedAmountStep(busdData, 10_000),
        new WithdrawPercentStep(busdData, 100),
      );

      await strategy.runSteps();
      expect((await testEnv.getTotalProfit()).lte(0)).to.eq(true);
    });

    it('unbalancing should not yield profit 3', async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 100_000),
        new SwapFixedAmountStep(bridge, usdtData, busdData, 100_000),
        new WithdrawFixedAmountStep(busdData, 10_116.673),
        new WithdrawFixedAmountStep(busdData, 4_450.182),
        new WithdrawFixedAmountStep(busdData, 3_006.073),
        new WithdrawFixedAmountStep(busdData, 2_317.069),
        new WithdrawFixedAmountStep(busdData, 1_904.694),
        new WithdrawFixedAmountStep(busdData, 1_626.611),
        new SwapFixedAmountStep(bridge, busdData, usdtData, 75_000),
        new WithdrawPercentStep(busdData, 100),
      );

      await strategy.runSteps();
      expect((await testEnv.getTotalProfit()).lte(0)).to.eq(true);
    });

    it('deposit - withdraw', async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 100_000),
        new WithdrawPercentStep(busdData, 100),
      );
      await strategy.runSteps();
    });
    it('deposit - swap from - withdraw', async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 100_000),
        new SwapFixedAmountStep(bridge, busdData, usdtData, 50_000),
        new WithdrawPercentStep(busdData, 100),
      );
      await strategy.runSteps();
    });
    it('deposit - swap to - withdraw', async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 100_000),
        new SwapFixedAmountStep(bridge, usdtData, busdData, 50_000),
        new WithdrawPercentStep(busdData, 100),
      );
      await strategy.runSteps();
    });

    it('deposit - swap - withdraw - swap back - withdraw', async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 100_000),
        new SwapFixedAmountStep(bridge, usdtData, busdData, 100_000),
        new WithdrawPercentStep(busdData, 100),
        new SwapFixedAmountStep(bridge, busdData, usdtData, 32_915),
        new WithdrawFixedAmountStep(busdData, 32_915),
      );
      await strategy.runSteps();
    });
  });

  describe('given balanced pool', () => {
    beforeEach(async () => {
      bridge = bridge.connect(owner);
      busdData = await PoolData.setup('BUSD', bridge, user, 500_000, 1);
      usdtData = await PoolData.setup('USDT', bridge, user, 500_000, 1);

      bridge = bridge.connect(user);
      testEnv = new TestEnv(user, [busdData, usdtData]);
    });

    it('unbalancing should not yield profit 4', async () => {
      strategy.addSteps(
        new DepositPercentOfInitialPoolBalanceStep(busdData, 1000),
        new DepositPercentOfInitialPoolBalanceStep(usdtData, 200),
        new SwapPercentOfTokensInPoolStep(bridge, usdtData, busdData, 9),
        new WithdrawPercentStep(busdData, 100),
        new SwapPercentOfTokensInPoolStep(bridge, busdData, usdtData, 36),
        new WithdrawPercentStep(usdtData, 100),
      );

      await strategy.runSteps();
      expect((await testEnv.getTotalProfit()).lte(0)).to.eq(true);
    });

    it('hacker flow', async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 5_000_000),
        new DepositFixedAmountStep(usdtData, 2_000_000),
        new SwapFixedAmountStep(bridge, usdtData, busdData, 499_990),
        new WithdrawPercentStep(busdData, 100),
        new SwapFixedAmountStep(bridge, busdData, usdtData, 370_000),
        new WithdrawPercentStep(usdtData, 100),
      );

      await strategy.runSteps();
      expect((await testEnv.getTotalProfit()).lte(0)).to.eq(true);
    });

    it('swap - back swap', async () => {
      await strategy
        .addSteps(
          new SwapFixedAmountStep(bridge, busdData, usdtData, 500_000),
          new SwapFixedAmountStep(bridge, usdtData, busdData, 224_029),
        )
        .runSteps();
      expect(+(await testEnv.getTotalProfit())).lte(0);
      expect(+(await testEnv.getTotalProfit())).closeTo(0, 0.01);
    });

    it(`withdraw small amount many times `, async () => {
      await strategy
        .addSteps(
          new DepositFixedAmountStep(busdData, 10_000),
          ...new Array(100)
            .fill(0)
            .map((_) => new WithdrawFixedAmountStep(busdData, 0.002)),
        )
        .runSteps();
      expect(+(await testEnv.getTotalProfit())).lte(0);
    });

    it('swap many times', async () => {
      const steps: StepInterface[] = new Array(200).fill(0).map((v, i) => {
        if (i % 2 === 0) {
          return new SwapFixedAmountStep(
            bridge,
            busdData,
            usdtData,
            randomNumber(1, 200_000),
          );
        } else {
          return new SwapFixedAmountStep(
            bridge,
            usdtData,
            busdData,
            randomNumber(1, 200_000),
          );
        }
      });
      steps.push(
        ...[
          new DepositFixedAmountStep(busdData, 0.001),
          new DepositFixedAmountStep(usdtData, 0.001),
          new WithdrawPercentStep(busdData, 100),
          new WithdrawPercentStep(usdtData, 100),
        ],
      );
      await strategy.addSteps(...steps).runSteps();
      expect(+(await testEnv.getTotalProfit())).lte(0);
      expect(+(await busdData.d())).closeTo(500000, 0.002);
      expect(+(await usdtData.d())).closeTo(500000, 0.002);
    });

    it('swap and update D many times', async () => {
      const steps: StepInterface[] = [];
      for (let i = 0; i < 100; i++) {
        steps.push(
          ...[
            new SwapFixedAmountStep(
              bridge,
              usdtData,
              busdData,
              randomNumber(1, 10_000),
            ),
            new DepositFixedAmountStep(busdData, 0.005),
            new DepositFixedAmountStep(usdtData, 0.005),
            new WithdrawPercentStep(busdData, 100),
            new WithdrawPercentStep(usdtData, 100),
            new SwapFixedAmountStep(
              bridge,
              busdData,
              usdtData,
              randomNumber(1, 10_000),
            ),
            new DepositFixedAmountStep(busdData, 0.005),
            new DepositFixedAmountStep(usdtData, 0.005),
            new WithdrawPercentStep(busdData, 100),
            new WithdrawPercentStep(usdtData, 100),
          ],
        );
      }
      await strategy.addSteps(...steps).runSteps();
      expect(+(await testEnv.getTotalProfit())).lte(0);
      expect(+(await busdData.d()))
        .gte(500000)
        .and.lte(500000.3);
      expect(+(await usdtData.d()))
        .gte(500000)
        .and.lte(500000.3);
    }).timeout(500_000);

    it('deposit - withdraw', async () => {
      await strategy
        .addSteps(
          new DepositPercentOfInitialPoolBalanceStep(busdData, 100),
          new WithdrawPercentStep(busdData, 100),
        )
        .runSteps();
      expect(+(await testEnv.getTotalProfit())).lte(0);
      expect(+(await testEnv.getTotalProfit())).closeTo(0, 1);
    });

    it('deposit - swap - withdraw', async () => {
      await strategy
        .addSteps(
          new DepositPercentOfInitialPoolBalanceStep(busdData, 100),
          new SwapFixedAmountStep(bridge, usdtData, busdData, 500_000),
          new WithdrawPercentStep(busdData, 100),
        )
        .runSteps();
      expect(+(await testEnv.getTotalProfit())).lte(0);
    });

    it('deposit - swap - withdraw 99% - deposit - withdraw', async () => {
      await strategy
        .addSteps(
          new DepositPercentOfInitialPoolBalanceStep(busdData, 100),
          new SwapFixedAmountStep(bridge, usdtData, busdData, 500_000),
          new WithdrawPercentStep(busdData, 99),
          new DepositFixedAmountStep(busdData, 50_000),
          new WithdrawPercentStep(busdData, 100),
        )
        .runSteps();
      expect(+(await testEnv.getTotalProfit())).lte(0);
    });

    it('deposit - swap - withdraw - swap back (reserves flow)', async () => {
      await strategy
        .addSteps(
          new DepositPercentOfInitialPoolBalanceStep(busdData, 100),
          new SwapFixedAmountStep(bridge, usdtData, busdData, 500_000),
          new WithdrawPercentStep(busdData, 100),
          new SwapFixedAmountStep(bridge, busdData, usdtData, 122_077),
        )
        .runSteps();
      expect(+(await testEnv.getTotalProfit())).lte(0);
    });

    it('deposit on slightly unbalanced pool', async () => {
      await new SwapPercentOfTokensInPoolStep(
        bridge,
        busdData,
        usdtData,
        50,
      ).run(owner);

      await strategy
        .addSteps(new DepositFixedAmountStep(busdData, 1_000))
        .runSteps();
    });
  });

  describe('D < Total LP Test', () => {
    beforeEach(async () => {
      bridge = bridge.connect(owner);
      busdData = await PoolData.setup('BUSD', bridge, user, '100000', 1);
      usdtData = await PoolData.setup('USDT', bridge, user, '100000', 1);
      testEnv = new TestEnv(user, [busdData, usdtData]);
    });

    it('Success', async () => {
      await strategy
        .addSteps(
          new DepositFixedAmountStep(usdtData, '49999999.999999999999999998'),
          new DepositFixedAmountStep(busdData, '26879046.493764933909030207'),
          new SwapFixedAmountStep(bridge, usdtData, busdData, '13489523.246'),
          new DepositFixedAmountStep(usdtData, '49999999.000084443571595002'),
          new SwapFixedAmountStep(bridge, usdtData, busdData, '1466056.52'),
          new SwapFixedAmountStep(bridge, busdData, usdtData, '78286336.347'),
          new DepositFixedAmountStep(usdtData, '35791241.528386537981938678'),
          new WithdrawFixedAmountStep(usdtData, '86.706'),
        )
        .runSteps();
      expect(+(await usdtData.d())).closeTo(
        +(await usdtData.totalLpBalance()),
        0.002,
      );
    });
  });

  describe('given unbalanced pool', () => {
    const balanceProfit = 275970.581; // profit if you just balance the pools
    beforeEach(async () => {
      bridge = bridge.connect(owner);
      busdData = await PoolData.setup('BUSD', bridge, user, 500_000, 1);
      usdtData = await PoolData.setup('USDT', bridge, user, 500_000, 1);

      await new SwapPercentOfTokensInPoolStep(
        bridge,
        busdData,
        usdtData,
        100,
      ).run(owner);
      testEnv = new TestEnv(user, [busdData, usdtData]);
    });

    const pools = [
      ['more real balance', () => busdData],
      ['more virtual balance', () => usdtData],
    ] as const;

    pools.forEach(([description, getPoolData]) => {
      it(`deposit (${description})`, async () => {
        await strategy
          .addSteps(new DepositFixedAmountStep(getPoolData(), 500_000))
          .runSteps();

        expect(+(await getPoolData().userLpBalance())).lte(500_000);
        expect(+(await getPoolData().userLpBalance())).gte(330_000);
      });
      it(`deposit - withdraw (${description})`, async () => {
        await strategy
          .addSteps(
            new DepositFixedAmountStep(getPoolData(), 500_000),
            new WithdrawPercentStep(getPoolData(), 100),
          )
          .runSteps();
        expect(+(await getPoolData().userLpBalance())).eq(0);
        expect(+(await testEnv.getTotalProfit())).lte(0);
      });
      it(`withdraw small amount many times  (${description})`, async () => {
        await strategy
          .addSteps(
            new DepositFixedAmountStep(getPoolData(), 10_000),
            ...new Array(100)
              .fill(0)
              .map((_) => new WithdrawFixedAmountStep(getPoolData(), 0.008)),
          )
          .runSteps();
        expect(+(await testEnv.getTotalProfit())).lte(balanceProfit);
      });
      it(`deposit - withdraw - adjust - deposit - withdraw (${description})`, async () => {
        await strategy
          .addSteps(
            new DepositFixedAmountStep(getPoolData(), 500_000),
            new WithdrawPercentStep(getPoolData(), 100),
            new AdjustTotalLpAmountStep(getPoolData()),
            new DepositFixedAmountStep(getPoolData(), 500_000),
            new WithdrawPercentStep(getPoolData(), 100),
          )
          .runSteps();
        expect(+(await getPoolData().userLpBalance())).eq(0);
        expect(+(await testEnv.getTotalProfit())).lte(0);
      });

      it(`deposit - withdraw in loop (${description})`, async () => {
        const steps = [];
        for (let i = 0; i < 20; i++) {
          steps.push(
            ...[
              new DepositFixedAmountStep(getPoolData(), 50_000),
              new WithdrawPercentStep(getPoolData(), 100),
            ],
          );
        }
        await strategy.addSteps(...steps).runSteps();
        expect(+(await testEnv.getTotalProfit())).lte(0);
      });

      it(`random deposit - withdraw in loop (${description})`, async () => {
        const steps = [];
        for (let i = 0; i < 100; i++) {
          steps.push(
            ...[
              new DepositFixedAmountStep(
                getPoolData(),
                randomNumber(1, 200_000),
              ),
              new WithdrawPercentStep(getPoolData(), randomNumber(1, 99)),
            ],
          );

          if (i % 10 === 0) {
            steps.push(
              ...[
                new SwapFixedAmountStep(
                  bridge,
                  busdData,
                  usdtData,
                  randomNumber(1, 200_000),
                ),
                new SwapFixedAmountStep(
                  bridge,
                  usdtData,
                  busdData,
                  randomNumber(1, 200_000),
                ),
              ],
            );
          }
        }
        await strategy.addSteps(...steps).runSteps();
        expect(+(await testEnv.getTotalProfit())).lte(balanceProfit);
      });

      it(`deposit - unbalance swap - withdraw (${description})`, async () => {
        await strategy
          .addSteps(
            new DepositFixedAmountStep(getPoolData(), 500_000),
            new SwapFixedAmountStep(bridge, busdData, usdtData, 500_000),
            new WithdrawPercentStep(getPoolData(), 100),
          )
          .runSteps();
        expect(+(await testEnv.getTotalProfit())).lte(balanceProfit);
      });

      it(`deposit - balance swap - withdraw (${description})`, async () => {
        await strategy
          .addSteps(
            new DepositFixedAmountStep(getPoolData(), 500_000),
            new SwapFixedAmountStep(bridge, usdtData, busdData, 100_000),
            new WithdrawPercentStep(getPoolData(), 100),
          )
          .runSteps();
        expect(+(await testEnv.getTotalProfit())).lte(balanceProfit);
      });
    });
  });

  describe('balance ratio validation', () => {
    beforeEach(async () => {
      bridge = bridge.connect(owner);
      busdData = await PoolData.setup('BUSD', bridge, user, 0, 190);
      usdtData = await PoolData.setup('USDT', bridge, user, 1_000_000, 500);

      bridge = bridge.connect(user);
      testEnv = new TestEnv(user, [busdData, usdtData]);
    });

    it('disbalancing should be rejected', async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 50_000),
        new SwapFixedAmountStep(bridge, busdData, usdtData, 35_000),
      );
      await expect(strategy.runSteps()).to.be.revertedWith(
        'Pool: low vUSD balance',
      );
    });

    it("disbalancing that doesn't exceed the threshold should be OK", async () => {
      strategy.addSteps(
        new DepositFixedAmountStep(busdData, 50_000),
        new SwapFixedAmountStep(bridge, busdData, usdtData, 30_000),
      );

      await strategy.runSteps();
      expect((await testEnv.getTotalProfit()).lte(0)).to.eq(true);
    });
  });
});
