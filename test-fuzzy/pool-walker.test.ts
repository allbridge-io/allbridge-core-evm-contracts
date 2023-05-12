import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { TestBridgeForSwap } from '../typechain';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { StepFactory } from './pool-utils/step-factory';
import { Strategy } from './pool-utils/strategy';
import { PoolData } from './pool-utils/pool-data';
import { TestEnv } from './pool-utils/test-env';
import {
  DepositPercentOfInitialPoolBalanceStep,
  SwapPercentOfTokensInPoolStep,
  WithdrawPercentStep,
} from './pool-utils/step';
import { StrategyGenerator } from './pool-utils/strategy-generator';

describe('Pool walker', () => {
  let bridge: TestBridgeForSwap;
  let busdData: PoolData;
  let usdtData: PoolData;
  let testEnv: TestEnv;
  let attacker: SignerWithAddress;
  before(async () => {
    attacker = (await ethers.getSigners())[1];
  });

  async function deployContractsFixture() {
    attacker = (await ethers.getSigners())[1];
    const SwapContract = await ethers.getContractFactory('TestBridgeForSwap');
    bridge = (await SwapContract.deploy()) as any;
    busdData = await PoolData.setup('BUSD', bridge, attacker, 500_000, 0);
    usdtData = await PoolData.setup('USDT', bridge, attacker, 500_000, 0);
    bridge = bridge.connect(attacker);
  }

  it('Random walk', async () => {
    const numberOfStepsInStrategy = 5;
    const stopOnError = false;
    await loadFixture(deployContractsFixture);

    // configure steps
    testEnv = new TestEnv(attacker, [busdData, usdtData]);
    const randomPoolConfig = StepFactory.randomElementConfig(
      testEnv.poolDataList,
    );
    const twoRandomPoolsConfig = StepFactory.randomElementConfig(
      testEnv.poolDataList,
      2,
    );
    // prettier-ignore
    const stepTemplates = [
      // { type: DepositPercentOfInitialPoolBalanceStep, config: [randomPoolConfig, 50] },
      { type: DepositPercentOfInitialPoolBalanceStep, config: [randomPoolConfig, 110] },
      // { type: DepositPercentOfInitialPoolBalanceStep, config: [randomPoolConfig, 1000] },
      { type: WithdrawPercentStep, config: [randomPoolConfig, 100] },
      // { type: WithdrawPercentStep, config: [randomPoolConfig, 50] },
      { type: SwapPercentOfTokensInPoolStep, config: [bridge, twoRandomPoolsConfig, 50] },
      // { type: SwapPercentOfTokensInPoolStep, config: [bridge, twoRandomPoolsConfig, 33] },
    ];

    // Generate strategies
    const generator = new StrategyGenerator(
      new StepFactory(stepTemplates),
      numberOfStepsInStrategy,
    );
    let stopRun = false;
    console.time('Total run time');
    for (const strategy of generator) {
      if (stopRun) break;
      await loadFixture(deployContractsFixture);
      try {
        for (const step of strategy.steps) {
          await step.run();

          // Checks after each step

          // is profitable?
          if ((await testEnv.getTotalProfitWithLp()).gt(0)) {
            stopRun = true;
            await testEnv.logUsersTotalAmount();
            await runWithFullLogs(strategy, 'Profitable strategy');
            break;
          }

          // prettier-ignore
          for (const poolDatum of testEnv.poolDataList) {
            if ((await poolDatum.poolReserves()).gt(await poolDatum.tokenBalance(poolDatum.pool.address))) {
              stopRun = true;
              await testEnv.logPoolsStateWithUsersBalances();
              await runWithFullLogs(strategy, `Pool's ${poolDatum.tokenSymbol} reserves are not backed by tokens`);
            }
          }
        }
      } catch (e) {
        console.error(e);
        strategy.logSteps();
        await testEnv.logPoolsStateWithUsersBalances();
        await testEnv.logUsersTotalAmount();
        if (stopOnError) {
          await runWithFullLogs(strategy, 'Error');
          break;
        }
      }
      await testEnv.logUsersTotalProfit();
    }
    console.timeEnd('Total run time');
    console.log(
      'Number of strategies =',
      generator.numberOfStrategies.toString(),
    );
  }).timeout(1_000_000);

  async function runWithFullLogs(_strategy: Strategy, title: string) {
    await loadFixture(deployContractsFixture);
    const strategy = new Strategy().addSteps(..._strategy.steps);
    console.log('==================\n' + title);
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
    await strategy.runSteps();
    console.log('==================');
  }
});
