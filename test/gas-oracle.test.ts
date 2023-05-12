import { expect } from 'chai';
import { ethers } from 'hardhat';
import { GasOracle } from '../typechain';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { Big } from 'big.js';

const CHAIN_1 = 1;
const CHAIN_2 = 2;
const CHAIN_3 = 3;
const ORACLE_PRECISION = 18;

describe('GasOracle', () => {
  let gasOracle: GasOracle;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, user] = await ethers.getSigners();
  });

  async function deployContracts(chainPrecision: number) {
    const contractFactory = (await ethers.getContractFactory(
      'GasOracle',
    )) as any;
    gasOracle = await contractFactory
      .connect(owner)
      .deploy(CHAIN_1, chainPrecision);
  }

  describe('given chain precision is 18', () => {
    const CHAIN_PRECISION = 18;
    beforeEach(async function () {
      await deployContracts(CHAIN_PRECISION);
    });

    describe('setChainData', () => {
      it('Success: should set chain data', async () => {
        await gasOracle.setChainData(
          CHAIN_1,
          parseUnits('100', ORACLE_PRECISION),
          parseUnits('0.00005', ORACLE_PRECISION),
        );
        const chain1ChainData = await gasOracle.chainData(CHAIN_1);
        expect(chain1ChainData.price).eq(parseUnits('100', ORACLE_PRECISION));
        expect(chain1ChainData.gasPrice).eq(
          parseUnits('0.00005', ORACLE_PRECISION),
        );
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          gasOracle.connect(user).setChainData(CHAIN_1, 0, 0),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('setPrice', () => {
      it('Success: should set the price of the native token', async () => {
        await gasOracle.setPrice(CHAIN_1, parseUnits('100', ORACLE_PRECISION));

        const chain1ChainData = await gasOracle.chainData(CHAIN_1);
        expect(chain1ChainData.price).eq(parseUnits('100', ORACLE_PRECISION));
        expect(chain1ChainData.gasPrice).eq('0');
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(gasOracle.connect(user).setPrice(CHAIN_1, 0)).revertedWith(
          'Ownable: caller is not the owner',
        );
      });
    });

    describe('setGasPrice', () => {
      it('Success: should set the price of a gas unit in native tokens', async () => {
        await gasOracle.setGasPrice(
          CHAIN_1,
          parseUnits('0.00005', ORACLE_PRECISION),
        );

        const chain1ChainData = await gasOracle.chainData(CHAIN_1);
        expect(chain1ChainData.price).eq('0');
        expect(chain1ChainData.gasPrice).eq(
          parseUnits('0.00005', ORACLE_PRECISION),
        );
      });

      it('Failure: should revert when the caller is not the owner', async () => {
        await expect(
          gasOracle.connect(user).setGasPrice(CHAIN_1, 0),
        ).revertedWith('Ownable: caller is not the owner');
      });
    });

    describe('crossRate', () => {
      it('Success: should return cross rate', async () => {
        await gasOracle.setPrice(CHAIN_1, parseUnits('100', ORACLE_PRECISION));

        await gasOracle.setPrice(CHAIN_2, parseUnits('200', ORACLE_PRECISION));
        const rate2 = await gasOracle.crossRate(CHAIN_2);
        expect(rate2).eq(parseUnits('2', ORACLE_PRECISION));

        await gasOracle.setPrice(CHAIN_3, parseUnits('50', ORACLE_PRECISION));
        const rate3 = await gasOracle.crossRate(CHAIN_3);
        expect(rate3).eq(parseUnits('0.5', ORACLE_PRECISION));
      });
    });

    describe('price', () => {
      it('Success: should return price of the native token in USD', async () => {
        await gasOracle.setPrice(CHAIN_1, parseUnits('100', ORACLE_PRECISION));

        expect(await gasOracle.price(CHAIN_1)).eq(
          parseUnits('100', ORACLE_PRECISION),
        );
      });
    });

    describe('getTransactionGasCostInNativeToken', () => {
      it('Success: should return transaction gas cost in wei', async () => {
        await gasOracle.setChainData(
          CHAIN_1,
          // price = 2000 USD / ETH
          parseUnits('2000', ORACLE_PRECISION),
          // gas price = 100 gwei
          parseUnits(formatUnits('100', 'gwei'), ORACLE_PRECISION),
        );

        await gasOracle.setChainData(
          CHAIN_2,
          // price = 0.1 USD / TRX
          parseUnits('0.1', ORACLE_PRECISION),
          // gas price = 420 SUN
          parseUnits(formatUnits(420, 6), ORACLE_PRECISION),
        );

        const gasAmount = 50000;
        const gasPriceInTrx = +formatUnits(420, 6); // 0.00042 TRX
        const txCostInTrx = gasPriceInTrx * gasAmount; // 21 TRX
        const txCostInUsd = txCostInTrx * 0.1; // 2.1 USD
        const expectedTxCostInEth = txCostInUsd / 2000; // 0.00105 ETH

        const actual = await gasOracle.getTransactionGasCostInNativeToken(
          CHAIN_2,
          gasAmount,
        );
        expect(actual).eq(
          parseUnits(
            expectedTxCostInEth.toFixed(CHAIN_PRECISION),
            CHAIN_PRECISION,
          ),
        );
      });
    });

    describe('getTransactionGasCostInUSD', () => {
      it('Success: should return transaction gas cost in USD', async () => {
        await gasOracle.setChainData(
          CHAIN_2,
          // price = 0.1 USD / TRX
          parseUnits('0.1', ORACLE_PRECISION),
          // gas price = 420 SUN
          parseUnits(formatUnits(420, 6), ORACLE_PRECISION),
        );

        const gasAmount = 50000;
        const gasPriceInTrx = +formatUnits(420, 6); // 0.00042 TRX
        const txCostInTrx = gasPriceInTrx * gasAmount; // 21 TRX
        const expectedTxCostInUsd = txCostInTrx * 0.1; // 2.1 USD

        const actual = await gasOracle.getTransactionGasCostInUSD(
          CHAIN_2,
          gasAmount,
        );
        expect(actual).eq(
          parseUnits(expectedTxCostInUsd.toString(), ORACLE_PRECISION),
        );
      });
    });
  });

  describe('given chain precision is 6', () => {
    const CHAIN_PRECISION = 6;
    beforeEach(async function () {
      await deployContracts(CHAIN_PRECISION);
    });

    describe('getTransactionGasCostInNativeToken', () => {
      it('Success: should return transaction gas cost in SUN', async () => {
        await gasOracle.setChainData(
          CHAIN_1,
          // price = 0.1 USD / TRX
          parseUnits('0.1', ORACLE_PRECISION),
          // gas price = 420 SUN
          parseUnits(formatUnits(420, 6), ORACLE_PRECISION),
        );

        await gasOracle.setChainData(
          CHAIN_2,
          // price = 2000 USD / ETH
          parseUnits('2000', ORACLE_PRECISION),
          // gas price = 100 gwei
          parseUnits(formatUnits('100', 'gwei'), ORACLE_PRECISION),
        );

        const gasAmount = 100_000;
        const gasPriceInEth = formatUnits('100', 'gwei'); // 0.0000001 ETH
        const txCostInEth = Big(gasPriceInEth).mul(gasAmount); // 0.01 ETH
        const txCostInUsd = txCostInEth.mul('2000'); // 20 USD
        const expectedTxCostInTrx = txCostInUsd.div('0.1'); // 200 TRX

        const actual = await gasOracle.getTransactionGasCostInNativeToken(
          CHAIN_2,
          gasAmount,
        );
        expect(actual).eq(
          parseUnits(
            expectedTxCostInTrx.toFixed(CHAIN_PRECISION),
            CHAIN_PRECISION,
          ),
        );
      });
    });
  });
});
