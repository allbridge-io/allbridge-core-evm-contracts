import { ethers } from 'hardhat';
import { assert, expect } from 'chai';
import { AutoDepositParent, GasOracle, Token } from '../typechain';
import { parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

const CHAIN_1 = 1;
const CHAIN_2 = 2;
const CHAIN_3 = 3;
const CHAIN_4 = 4;
const ORACLE_PRECISION = 18;

describe('AutoDepositParent', () => {
  let autoDepositParent: AutoDepositParent;
  let token: Token;
  let gasOracle: GasOracle;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;

  async function setupContractsFixture(
    chainPrecision: number,
    tokenPrecision: number,
  ) {
    const tokenContractFactory = await ethers.getContractFactory('Token');
    const contractFactory = (await ethers.getContractFactory(
      'AutoDepositParent',
    )) as any;
    const gasOracleFactory = (await ethers.getContractFactory(
      'GasOracle',
    )) as any;
    [owner, alice] = await ethers.getSigners();

    gasOracle = await gasOracleFactory.deploy(CHAIN_1, chainPrecision);
    await gasOracle.setChainData(
      CHAIN_1,
      parseUnits('1', ORACLE_PRECISION),
      '0',
    );
    await gasOracle.setChainData(
      CHAIN_2,
      parseUnits('2', ORACLE_PRECISION),
      parseUnits('3.0', 'gwei'),
    );
    await gasOracle.setChainData(
      CHAIN_3,
      parseUnits('3', ORACLE_PRECISION),
      parseUnits('3.0', 'gwei'),
    );
    await gasOracle.setChainData(
      CHAIN_4,
      parseUnits('4', ORACLE_PRECISION),
      parseUnits('3.0', 'gwei'),
    );

    token = (await tokenContractFactory.deploy(
      'A',
      'A',
      parseUnits('100000000000000000000', tokenPrecision),
      tokenPrecision,
    )) as any;

    autoDepositParent = await contractFactory.deploy(
      CHAIN_1,
      chainPrecision,
      gasOracle.address,
    );
    console.log('Contracts deployed');

    await autoDepositParent.setGasUsage(CHAIN_2, '2000');
    await autoDepositParent.setGasUsage(CHAIN_3, '3000');
    await autoDepositParent.setGasUsage(CHAIN_4, '4000');
    await autoDepositParent.registerToken(token.address);

    await token.transfer(alice.address, parseUnits('1000', tokenPrecision));
    await token.approve(autoDepositParent.address, ethers.constants.MaxUint256);
    await token
      .connect(alice)
      .approve(autoDepositParent.address, ethers.constants.MaxUint256);
    console.log('Contracts set up');
  }

  const testArguments = [
    {
      chainPrecision: 18,
      tokenPrecision: 18,
    },
    {
      chainPrecision: 6,
      tokenPrecision: 6,
    },
  ];
  for (const args of testArguments) {
    describe(`when chain precision: ${args.chainPrecision}; token precision: ${args.tokenPrecision}`, () => {
      const chainPrecision = args.chainPrecision;
      const tokenPrecision = args.tokenPrecision;

      async function setupContractsFixtureWithGivenPrecision() {
        await setupContractsFixture(chainPrecision, tokenPrecision);
      }

      beforeEach(async () => {
        await loadFixture(setupContractsFixtureWithGivenPrecision);
        assert(
          +(await token.decimals()) === tokenPrecision,
          'Invalid test configuration: unexpected token precision',
        );
      });

      describe('createDepositWalletsBatch', () => {
        const minDepositAmount = parseUnits('100', 18);

        it('Success: should emit event DepositAddressCreationEvent', async () => {
          const feeTokenAmount = parseUnits('10', tokenPrecision);
          const response = await autoDepositParent
            .connect(alice)
            .createDepositWalletsBatch(
              alice.address,
              token.address,
              minDepositAmount,
              feeTokenAmount,
              [CHAIN_2, CHAIN_3, CHAIN_4],
              { value: '11000' },
            );
          const receipt = await response.wait();
          const args = receipt.events?.find(
            (ev) => ev.event === 'DepositAddressCreationEvent',
          )?.args;
          expect(args?.recipient).to.eq(alice.address);
          expect(args?.recipientToken).to.eq(token.address);
          expect(args?.minDepositAmount).to.eq(minDepositAmount);
          expect(args?.chainIds[0]).to.eq(CHAIN_2);
          expect(args?.chainIds[1]).to.eq(CHAIN_3);
          expect(args?.chainIds[2]).to.eq(CHAIN_4);
        });

        it('Success: should collect payment', async () => {
          const feeTokenAmount = parseUnits('10', tokenPrecision);
          const tx = await autoDepositParent
            .connect(alice)
            .createDepositWalletsBatch(
              alice.address,
              token.address,
              minDepositAmount,
              feeTokenAmount,
              [CHAIN_2, CHAIN_3, CHAIN_4],
              { value: '11000' },
            );
          expect(tx).to.changeTokenBalances(
            autoDepositParent,
            [alice, autoDepositParent.address],
            ['-' + feeTokenAmount.toString(), feeTokenAmount.toString()],
          );
        });

        it('Failure: should fail when not enough payment', async () => {
          const feeTokenAmount = 0;
          await expect(
            autoDepositParent
              .connect(alice)
              .createDepositWalletsBatch(
                alice.address,
                token.address,
                minDepositAmount,
                feeTokenAmount,
                [CHAIN_2],
                { value: '0' },
              ),
          ).to.be.revertedWith('ADF: not enough fee');
        });
      });

      describe('Admin methods', () => {
        describe('withdrawGas', () => {
          let amount: string;

          beforeEach(async () => {
            // transfer gas tokens to the contract
            await autoDepositParent.createDepositWalletsBatch(
              alice.address,
              token.address,
              1,
              0,
              [],
              { value: '123456789123456789' },
            );

            amount = (
              await ethers.provider.getBalance(autoDepositParent.address)
            ).toString();
            assert(
              +amount > 0,
              'Invalid test config: contract gas balance should be greater than 0',
            );
          });

          it('Success: should withdraw accumulated gas', async () => {
            expect(
              await autoDepositParent.withdrawGas(amount),
            ).changeEtherBalances(
              [owner, autoDepositParent],
              [amount, '-' + amount],
            );
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              autoDepositParent.connect(alice).withdrawGas('1'),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('withdraw', () => {
          const tokenAmount = parseUnits('1000', tokenPrecision);

          beforeEach(async () => {
            await token.transfer(autoDepositParent.address, tokenAmount);
          });

          it('Success: should withdraw accumulated tokens', async () => {
            expect(
              await autoDepositParent.withdraw(token.address),
            ).changeTokenBalances(
              token,
              [owner, autoDepositParent],
              [tokenAmount, '-' + tokenAmount],
            );
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              autoDepositParent.connect(alice).withdraw(token.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('registerToken', () => {
          let newToken: Token;
          beforeEach(async () => {
            const tokenContractFactory = await ethers.getContractFactory(
              'Token',
            );
            newToken = (await tokenContractFactory.deploy(
              'B',
              'B',
              parseUnits('100000000000000000000', tokenPrecision),
              tokenPrecision,
            )) as any;
          });

          it('Success: should make token accepted', async () => {
            await autoDepositParent.registerToken(newToken.address);
            expect(
              await autoDepositParent.acceptedTokens(newToken.address),
            ).to.eq(true);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              autoDepositParent.connect(alice).registerToken(newToken.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });

        describe('unregisterToken', () => {
          it('Success: should make token not accepted', async () => {
            await autoDepositParent.unregisterToken(token.address);
            expect(await autoDepositParent.acceptedTokens(token.address)).to.eq(
              false,
            );
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              autoDepositParent.connect(alice).unregisterToken(token.address),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });
      });
    });
  }
});
