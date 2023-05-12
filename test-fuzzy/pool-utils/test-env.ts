import { PoolData } from './pool-data';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { BigNumber } from 'ethers';
import { Big, BigSource } from 'big.js';
import numeral from 'numeral';
import { table } from 'table';

export class TestEnv {
  user: SignerWithAddress;
  poolDataList: PoolData[] = [];

  constructor(user: SignerWithAddress, poolDataList: PoolData[]) {
    this.user = user;
    this.poolDataList.push(...poolDataList);
  }

  async logUsersTotalAmount() {
    const totalAmount = formatNumber(await this.getTotalAmount());
    const totalAmountWithLp = formatNumber(await this.getTotalAmountWithLP());
    console.log(
      `User's total amount: ${totalAmount} (with LP ${totalAmountWithLp})`,
    );
  }

  async logUsersBalances() {
    const tableData = [];

    for (const poolDatum of this.poolDataList) {
      const userBalance = await poolDatum.tokenBalance(this.user.address);
      const userLP = await poolDatum.userLpBalance();
      const formattedPoolData = {
        tokenSymbol: poolDatum.tokenSymbol,
        userBalance: formatNumber(userBalance),
        userLP: formatNumber(userLP),
      };

      tableData.push(Object.values(formattedPoolData));
    }
    const tableHeaders = ['', 'User Balance', 'User LP'];

    const formattedTable = table([tableHeaders, ...tableData], {
      columnDefault: { alignment: 'right' },
    });

    console.log(formattedTable);
  }

  async logUsersTotalProfit() {
    console.log(
      `User's total profit: ${formatAsAbbreviatedNumber(
        await this.getTotalProfit(),
      )}`,
    );
  }

  async logPoolsStateWithUsersBalances() {
    const tableData = [];

    for (const poolDatum of this.poolDataList) {
      const formattedPoolData = {
        tokenSymbol: poolDatum.tokenSymbol,
        tokenBalance: formatNumber(await poolDatum.poolTokenBalance()),
        vUsdBalance: formatNumber(await poolDatum.poolVUsdBalance()),
        reserved: formatNumber(await poolDatum.poolReserves()),
        D: formatNumber(await poolDatum.d()),
        poolBalance: formatNumber(
          await poolDatum.tokenBalance(poolDatum.pool.address),
        ),
        totalLP: formatNumber(await poolDatum.totalLpBalance()),
        userLP: formatNumber(await poolDatum.userLpBalance()),
        userBalance: formatNumber(
          await poolDatum.tokenBalance(this.user.address),
        ),
      };

      tableData.push(Object.values(formattedPoolData));
    }

    const tableHeaders = [
      '',
      'tokenBalance',
      'vUSD',
      'Reserved',
      'D',
      'Pool Balance',
      'Total LP',
      'User LP',
      'User Balance',
    ];

    const formattedTable = table([tableHeaders, ...tableData], {
      columnDefault: { alignment: 'right' },
    });

    console.log(formattedTable);
  }

  async getTotalAmountWithLP() {
    const totalBalance = await this.getTotalAmount();
    const totalLp = await this.getTotalLP();
    return totalBalance.add(totalLp);
  }

  async getTotalProfit() {
    const totalBalance = await this.getTotalAmount();
    const totalInitialBalance = this.getTotalInitialAmount();
    return totalBalance.sub(totalInitialBalance);
  }

  async getTotalProfitWithLp() {
    const totalBalanceWithLp = await this.getTotalAmountWithLP();
    const totalInitialBalance = this.getTotalInitialAmount();
    return totalBalanceWithLp.sub(totalInitialBalance);
  }

  async getTotalProfitPercentWithLp() {
    const totalProfitWithLp = await this.getTotalProfitWithLp();
    return totalProfitWithLp
      .div(this.getTotalInitialAmount())
      .mul(100)
      .toNumber();
  }

  private async getTotalLP() {
    let totalBalance = Big(0);
    for (const poolDatum of this.poolDataList) {
      totalBalance = totalBalance.add(await poolDatum.userLpBalance());
    }
    return totalBalance;
  }

  private async getTotalAmount() {
    let totalBalance = Big(0);
    for (const poolDatum of this.poolDataList) {
      totalBalance = totalBalance.add(
        await poolDatum.tokenBalance(this.user.address),
      );
    }
    return totalBalance;
  }

  getTotalInitialAmount() {
    let totalInitialBalance = Big(0);
    for (const poolDatum of this.poolDataList) {
      totalInitialBalance = totalInitialBalance.add(
        poolDatum.initialUserTokenBalance,
      );
    }
    return totalInitialBalance;
  }
}

function formatNumber(num: BigSource | BigNumber) {
  const bigSource = BigNumber.isBigNumber(num) ? num.toString() : num;
  return Big(bigSource)
    .round(3, 0)
    .toNumber()
    .toLocaleString(undefined, { minimumFractionDigits: 3 });
}

function formatAsAbbreviatedNumber(num: BigSource | BigNumber) {
  const bigSource = BigNumber.isBigNumber(num) ? num.toString() : num;
  return numeral(Big(bigSource).toNumber()).format('0.[0]a');
}
