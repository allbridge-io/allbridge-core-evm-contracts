import { Pool, TestBridgeForSwap, Token } from '../../typechain';
import { ethers } from 'hardhat';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { addressToBase32, fromSystemPrecision, SP } from '../../test/utils';
import { Big, BigSource } from 'big.js';

export class PoolData {
  pool!: Pool;
  token!: Token;
  tokenSymbol: string;
  initialPoolTokenBalance!: Big;
  user!: SignerWithAddress;
  initialUserTokenBalance = '1000000000';

  private constructor(tokenSymbol: string) {
    this.tokenSymbol = tokenSymbol;
  }

  public static async setup(
    tokenSymbol: string,
    bridge: TestBridgeForSwap,
    user: SignerWithAddress,
    initialPoolTokens: BigSource,
    balanceRatioMinBP: number = 500,
  ) {
    return new PoolData(tokenSymbol).init(
      bridge,
      user,
      balanceRatioMinBP,
      initialPoolTokens,
    );
  }

  async poolTokenBalance() {
    return fromSystemPrecision((await this.pool.tokenBalance()).toString());
  }

  async poolVUsdBalance() {
    return fromSystemPrecision((await this.pool.vUsdBalance()).toString());
  }

  async poolReserves() {
    if (this.pool.reserves) {
      return fromSystemPrecision((await this.pool.reserves()).toString());
    } else {
      return Big(0);
    }
  }

  async d() {
    return fromSystemPrecision((await this.pool.d()).toString());
  }

  async tokenBalance(address: string) {
    return Big(formatUnits((await this.token.balanceOf(address)).toString()));
  }

  async userLpBalance() {
    return fromSystemPrecision(
      (await this.pool.balanceOf(this.user.address)).toString(),
    );
  }

  async totalLpBalance() {
    return fromSystemPrecision((await this.pool.totalSupply()).toString());
  }

  async deposit(amount: BigSource) {
    return this.pool.deposit(parseUnits(Big(amount).toFixed(18)));
  }

  async withdraw(amount: BigSource) {
    return this.pool.withdraw(parseUnits(Big(amount).toFixed(SP), SP));
  }

  private async init(
    bridge: TestBridgeForSwap,
    user: SignerWithAddress,
    balanceRatioMinBP: number,
    initialPoolTokens?: BigSource,
  ) {
    this.user = user;
    const TokenContract = await ethers.getContractFactory('Token');
    const PoolContract = await ethers.getContractFactory('Pool');

    this.token = (await TokenContract.deploy(
      this.tokenSymbol,
      this.tokenSymbol,
      parseUnits('1000000000000000000000'),
      18,
    )) as Token;

    this.pool = (await PoolContract.deploy(
      bridge.address,
      20,
      this.token.address,
      0,
      balanceRatioMinBP,
      'LP',
      'LP',
    )) as Pool;

    await this.token.transfer(
      user.address,
      parseUnits(this.initialUserTokenBalance),
    );

    await this.token.approve(
      this.pool.address,
      parseUnits('1000000000000000000000'),
    );

    await this.token.approve(
      bridge.address,
      parseUnits('1000000000000000000000'),
    );

    await bridge.addPool(
      this.pool.address,
      addressToBase32(this.token.address),
    );

    if (initialPoolTokens) {
      await this.deposit(initialPoolTokens);
    }

    this.pool = this.pool.connect(user);
    this.token = this.token.connect(user);

    await this.token.approve(
      this.pool.address,
      parseUnits('1000000000000000000000'),
    );

    await this.token.approve(
      bridge.address,
      parseUnits('1000000000000000000000'),
    );

    this.initialPoolTokenBalance = await this.tokenBalance(this.pool.address);
    return this;
  }
}
