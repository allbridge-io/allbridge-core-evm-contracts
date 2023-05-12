import { TestBridgeForSwap } from '../../typechain';
import { parseUnits } from 'ethers/lib/utils';
import { addressToBase32 } from '../../test/utils';
import { Big, BigSource } from 'big.js';
import { PoolData } from './pool-data';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { ethers } from 'hardhat';

export interface StepInterface {
  run(): Promise<void>;
  describe(): string;
}

abstract class DepositStep implements StepInterface {
  poolData: PoolData;

  constructor(poolData: PoolData) {
    this.poolData = poolData;
  }

  abstract getAmountToDeposit(): Big;

  async run() {
    const toDeposit = this.getAmountToDeposit();
    console.log(`Deposit ${toDeposit} ${this.poolData.tokenSymbol}`);
    await this.poolData.deposit(toDeposit);
  }

  abstract describe(): string;
}

export class DepositFixedAmountStep extends DepositStep {
  amount: BigSource;

  constructor(poolData: PoolData, amount: BigSource) {
    super(poolData);
    this.amount = amount;
  }

  getAmountToDeposit() {
    return Big(this.amount);
  }

  describe() {
    return `Deposit ${this.amount} ${this.poolData.tokenSymbol}`;
  }
}

export class DepositPercentOfInitialPoolBalanceStep extends DepositStep {
  percent: number;

  constructor(poolData: PoolData, percent: number) {
    super(poolData);
    this.percent = percent;
  }

  getAmountToDeposit() {
    return this.poolData.initialPoolTokenBalance.mul(this.percent / 100);
  }

  describe() {
    return `Deposit ${this.percent}% of ${this.poolData.tokenSymbol} pool`;
  }
}

abstract class WithdrawStep implements StepInterface {
  poolData: PoolData;

  constructor(poolData: PoolData) {
    this.poolData = poolData;
  }

  abstract getAmountToWithdraw(): Promise<Big>;

  async run() {
    const toWithdraw = await this.getAmountToWithdraw();
    if (toWithdraw.eq(0)) {
      return;
    }
    console.log(`Withdraw ${toWithdraw} LP-${this.poolData.tokenSymbol}`);
    await this.poolData.withdraw(toWithdraw);
  }

  abstract describe(): string;
}

export class AdjustTotalLpAmountStep implements StepInterface {
  poolData: PoolData;

  constructor(poolData: PoolData) {
    this.poolData = poolData;
  }

  async run(user?: SignerWithAddress) {
    console.log(`Adjust total LP amount`);
    if (!user) {
      const ownerAddress = await this.poolData.pool.owner();
      user = await ethers.getSigner(ownerAddress);
    }
    await this.poolData.pool.connect(user).adjustTotalLpAmount();
  }

  describe(): string {
    return 'Adjust total LP amount';
  }
}

export class WithdrawFixedAmountStep extends WithdrawStep {
  amount: BigSource;

  constructor(poolData: PoolData, amount: BigSource) {
    super(poolData);
    this.amount = amount;
  }

  async getAmountToWithdraw() {
    return Big(this.amount);
  }

  describe() {
    return `Withdraw ${this.amount} LP-${this.poolData.tokenSymbol}`;
  }
}

export class WithdrawPercentStep extends WithdrawStep {
  percent: number;

  constructor(poolData: PoolData, percent: number) {
    super(poolData);
    this.percent = percent;
  }

  async getAmountToWithdraw() {
    const lpBalance = await this.poolData.userLpBalance();
    const lpToWithdraw = lpBalance.mul(this.percent / 100);
    const reserves = await this.poolData.poolReserves();
    return lpToWithdraw.gt(reserves) ? reserves : lpToWithdraw;
  }

  describe() {
    return `Withdraw ${this.percent}% of LP-${this.poolData.tokenSymbol}`;
  }
}

abstract class SwapStep implements StepInterface {
  bridge: TestBridgeForSwap;
  sourcePoolData: PoolData;
  destinationPoolData: PoolData;

  constructor(
    bridge: TestBridgeForSwap,
    sourcePoolData: PoolData,
    destinationPoolData: PoolData,
  ) {
    this.bridge = bridge;
    this.sourcePoolData = sourcePoolData;
    this.destinationPoolData = destinationPoolData;
  }

  abstract getAmountToSwap(): Promise<Big>;

  async run(user?: SignerWithAddress) {
    user ??= this.sourcePoolData.user;
    const toSwap = await this.getAmountToSwap();
    console.log(
      `Swap ${toSwap} ${this.sourcePoolData.tokenSymbol} => ${this.destinationPoolData.tokenSymbol}`,
    );
    await this.bridge
      .connect(user)
      .swap(
        parseUnits(toSwap.toFixed(18, 0)),
        addressToBase32(this.sourcePoolData.token.address),
        addressToBase32(this.destinationPoolData.token.address),
        user.address,
        0,
      );
  }

  abstract describe(): string;
}

export class SwapFixedAmountStep extends SwapStep {
  amount: BigSource;

  constructor(
    bridge: TestBridgeForSwap,
    sourcePoolData: PoolData,
    destinationPoolData: PoolData,
    amount: BigSource,
  ) {
    super(bridge, sourcePoolData, destinationPoolData);
    this.amount = amount;
  }

  async getAmountToSwap(): Promise<Big> {
    return Big(this.amount);
  }

  describe() {
    return `Swap ${this.amount} ${this.sourcePoolData.tokenSymbol} to ${this.destinationPoolData.tokenSymbol}`;
  }
}

export class SwapPercentOfTokensInPoolStep extends SwapStep {
  percent: number;

  constructor(
    bridge: TestBridgeForSwap,
    sourcePoolData: PoolData,
    destinationPoolData: PoolData,
    percent: number,
  ) {
    super(bridge, sourcePoolData, destinationPoolData);
    this.percent = percent;
  }

  async getAmountToSwap(): Promise<Big> {
    const poolTokenReserves = await this.destinationPoolData.poolReserves();
    return poolTokenReserves.mul(this.percent / 100);
  }

  describe() {
    return `Swap ${this.sourcePoolData.tokenSymbol} to ${this.destinationPoolData.tokenSymbol} (${this.percent}% of ${this.destinationPoolData.tokenSymbol} pool)`;
  }
}
