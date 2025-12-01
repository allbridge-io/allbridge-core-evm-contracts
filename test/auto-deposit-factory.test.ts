import { ethers } from 'hardhat';
import { assert, expect } from 'chai';
import {
  AutoDepositFactory,
  AutoDepositWallet,
  GasOracle,
  MockBridge,
  Token,
} from '../typechain';
import { parseUnits, formatUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { addressToBytes32 } from '../scripts/helper';
import { BigNumber, ContractTransaction } from 'ethers';

const CHAIN_1 = 1;
const CHAIN_2 = 2;
const CHAIN_3 = 3;
const CHAIN_4 = 4;
const ORACLE_PRECISION = 18;

describe('AutoDepositFactory', () => {
  let autoDepositFactory: AutoDepositFactory;
  let wallet: AutoDepositWallet;
  let token: Token;
  let gasOracle: GasOracle;
  let owner: SignerWithAddress;
  let alice: SignerWithAddress;
  let bridge: MockBridge;

  let recipientChainId: number;
  let bridgeAddress: string;
  let recipientAddressBytes: string;
  let recipientTokenAddressBytes: string;
  let minDepositTokens: string;

  async function setupContractsFixture(
    chainPrecision: number,
    tokenPrecision: number,
  ) {
    const tokenContractFactory = await ethers.getContractFactory('Token');
    const contractFactory = (await ethers.getContractFactory(
      'AutoDepositFactory',
    )) as any;
    const gasOracleFactory = (await ethers.getContractFactory(
      'GasOracle',
    )) as any;
    const mockBridgeFactory = (await ethers.getContractFactory(
      'MockBridge',
    )) as any;

    [owner, alice] = await ethers.getSigners();

    gasOracle = await gasOracleFactory.deploy(CHAIN_1, chainPrecision);
    bridge = await mockBridgeFactory.deploy();
    await gasOracle.setChainData(
      CHAIN_1,
      parseUnits('4000', ORACLE_PRECISION),
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

    autoDepositFactory = await contractFactory.deploy(
      CHAIN_1,
      chainPrecision,
      gasOracle.address,
      0xff
    );
    console.log('Contracts deployed');

    await bridge.addPool(
      '0x5B02587a69dac7AFBC34eFa23982e95BCed3138c',
      addressToBytes32(token.address),
    );

    await autoDepositFactory.setGasUsage(CHAIN_2, '2000');
    await autoDepositFactory.setGasUsage(CHAIN_3, '3000');
    await autoDepositFactory.setGasUsage(CHAIN_4, '4000');
    await autoDepositFactory.registerToken(token.address);

    await token.transfer(alice.address, parseUnits('1000', tokenPrecision));
    await token.approve(
      autoDepositFactory.address,
      ethers.constants.MaxUint256,
    );
    await token
      .connect(alice)
      .approve(autoDepositFactory.address, ethers.constants.MaxUint256);
    console.log('Contracts set up');
  }

  async function initializeWallet(
    params: Partial<{
      recipientChainId: number;
      bridgeAddress: string;
      recipientAddress: string;
      recipientTokenAddress: string;
      minDepositTokens: string;
      signer: SignerWithAddress;
    }> & { testName: string },
  ) {
    const signer = params?.signer ?? owner;
    const {
      recipientChainId: recipientChainIdParam,
      bridgeAddress: bridgeAddressParams,
      recipientAddressBytes: recipientAddressBytesParams,
      recipientTokenAddressBytes: recipientTokenAddressBytesParams,
      minDepositAmount: minDepositTokensParams,
    } = getWalletParams(params);

    recipientChainId = recipientChainIdParam;
    bridgeAddress = bridgeAddressParams;
    recipientAddressBytes = recipientAddressBytesParams;
    recipientTokenAddressBytes = recipientTokenAddressBytesParams;
    minDepositTokens = minDepositTokensParams;

    const response = await autoDepositFactory
      .connect(signer)
      .deployDepositWallet(
        recipientChainId,
        bridgeAddress,
        recipientAddressBytes,
        recipientTokenAddressBytes,
        minDepositTokens,
      );
    const receipt = await response.wait();
    await recordTxPrice(params.testName, 'deplDepWallet', response);

    const args = receipt.events?.find(
      (ev) => ev.event === 'AutoDepositWalletDeployedEvent',
    )?.args;
    const walletAddress = args?.wallet;
    wallet = await ethers.getContractAt('AutoDepositWallet', walletAddress);
  }

  function getWalletParams(
    params?: Partial<{
      recipientChainId: number;
      bridgeAddress: string;
      recipientAddress: string;
      recipientTokenAddress: string;
      minDepositTokens: string;
      signer: SignerWithAddress;
    }>,
  ): {
    recipientChainId: number;
    bridgeAddress: string;
    recipient: string;
    recipientAddressBytes: string;
    recipientToken: string;
    recipientTokenAddressBytes: string;
    minDepositAmount: string;
  } {
    const recipient = params?.recipientAddress ?? alice.address;
    const recipientToken =
      params?.recipientTokenAddress ??
      '0xF052839B48eE462fedC250F5CEF8263DD569228b';
    return {
      recipientChainId: params?.recipientChainId ?? CHAIN_2,
      bridgeAddress: params?.bridgeAddress ?? bridge.address,
      recipient,
      recipientToken,
      recipientAddressBytes: addressToBytes32(recipient),
      recipientTokenAddressBytes: addressToBytes32(recipientToken),
      minDepositAmount: params?.minDepositTokens ?? '100',
    };
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

      describe('deployDepositWallet', () => {
        const recipientChainId = CHAIN_2;
        const bridgeAddress = '0x74c0a1D93d264EA515e9AAD9DAaD17452e9DA22E';
        const recipientAddressBytes = addressToBytes32(
          '0x6953Cc76152EEd73190C36Dc2681cFEB141f3E6e',
        );
        const recipientTokenAddressBytes = addressToBytes32(
          '0xF052839B48eE462fedC250F5CEF8263DD569228b',
        );
        const minDepositTokens = '100';

        it('Success: deployDepositWallet should deploy to expected address', async () => {
          const predictedAddress =
            await autoDepositFactory.getDepositWalletAddress(
              recipientChainId,
              bridgeAddress,
              recipientAddressBytes,
              recipientTokenAddressBytes,
              minDepositTokens,
            );

          const response = await autoDepositFactory.deployDepositWallet(
            recipientChainId,
            bridgeAddress,
            recipientAddressBytes,
            recipientTokenAddressBytes,
            minDepositTokens,
          );
          const receipt = await response.wait();
          const args = receipt.events?.find(
            (ev) => ev.event === 'AutoDepositWalletDeployedEvent',
          )?.args;
          expect(args?.wallet).to.eq(predictedAddress);
        });

        it('Success: deployDepositWallet should deploy with expected params', async () => {
          const response = await autoDepositFactory.deployDepositWallet(
            recipientChainId,
            bridgeAddress,
            recipientAddressBytes,
            recipientTokenAddressBytes,
            minDepositTokens,
          );
          const receipt = await response.wait();
          const args = receipt.events?.find(
            (ev) => ev.event === 'AutoDepositWalletDeployedEvent',
          )?.args;
          const walletAddress = args?.wallet;

          const walletContract = await ethers.getContractAt(
            'AutoDepositWallet',
            walletAddress,
          );
          expect(await walletContract.factory()).to.eq(
            autoDepositFactory.address,
          );
          expect(await walletContract.bridge()).to.eq(bridgeAddress);
          expect(await walletContract.recipientChainId()).to.eq(
            recipientChainId,
          );
          expect(await walletContract.recipient()).to.eq(recipientAddressBytes);
          expect(await walletContract.recipientToken()).to.eq(
            recipientTokenAddressBytes,
          );
          expect(await walletContract.minDepositAmount()).to.eq(
            minDepositTokens,
          );
        });
      });

      describe('swapAndBridge & createSwapAndBridge', () => {
        const bridgingCostInTokens = 10000;
        const nonce = '123';
        const messengerProtocol = 1;
        const amount = parseUnits('100', tokenPrecision);

        beforeEach(async () => {
          await autoDepositFactory.setSendTxCost(
            parseUnits('0.0001', chainPrecision),
          );
        });
        describe('swapAndBridge', () => {
          it('Success: swapAndBridge should charge send fee and call bridge', async () => {
            const testName = 'swapAndBridge';

            await initializeWallet({ testName });

            const expectedSendTxTokenFeeAmount = parseUnits(
              '0.4',
              tokenPrecision,
            ).toString();
            const expectedFeeAmount = bridgingCostInTokens + 1;
            await token.transfer(
              wallet.address,
              amount.add(expectedSendTxTokenFeeAmount),
            );

            // assert balance
            const response = await autoDepositFactory.swapAndBridge(
              wallet.address,
              token.address,
              nonce,
              messengerProtocol,
            );
            await recordTxPrice(testName, 'swapAndBridge', response);

            await expect(response)
              .to.emit(bridge, 'SwapAndBridgeEvent')
              .withArgs(
                addressToBytes32(token.address),
                amount,
                recipientAddressBytes,
                recipientChainId,
                recipientTokenAddressBytes,
                nonce,
                messengerProtocol,
                expectedFeeAmount,
                '0',
              );
          });

          it('Success: success with exact min amount', async () => {
            const testName = 'swapAndBridge';
            const minDepositTokens = formatUnits(amount, tokenPrecision);
            await initializeWallet({ testName, minDepositTokens: (+minDepositTokens).toString() });

            const expectedSendTxTokenFeeAmount = parseUnits(
              '0.4',
              tokenPrecision,
            ).toString();
            const relayerFee = await autoDepositFactory.getSendTxFeeTokenAmount(token.address);
            console.log('relayerFee', relayerFee.toString());
            const expectedFeeAmount = bridgingCostInTokens + 1;
            await token.transfer(
              wallet.address,
              amount.sub(1),
            );
            await expect(
              autoDepositFactory.swapAndBridge(
                wallet.address,
                token.address,
                nonce,
                messengerProtocol,
              ),
            ).to.be.revertedWith('ADF: amount too low');

            await token.transfer(
              wallet.address,
              1,
            );
            // assert balance
            const response = await autoDepositFactory.swapAndBridge(
              wallet.address,
              token.address,
              nonce,
              messengerProtocol,
            );
            await recordTxPrice(testName, 'swapAndBridge', response);

            await expect(response)
              .to.emit(bridge, 'SwapAndBridgeEvent')
              .withArgs(
                addressToBytes32(token.address),
                amount.sub(expectedSendTxTokenFeeAmount),
                recipientAddressBytes,
                recipientChainId,
                recipientTokenAddressBytes,
                nonce,
                messengerProtocol,
                expectedFeeAmount,
                '0',
              );
          });

          it('Success: swapAndBridge should charge send fee and call bridge with pre-registered wallet token', async () => {
            const testName = 'swapAndBridge with pre-registered wallet token';

            await initializeWallet({ testName });
            const registerToken = await wallet.registerToken(token.address);
            await recordTxPrice(testName, 'registerToken', registerToken);

            const expectedSendTxTokenFeeAmount = parseUnits(
              '0.4',
              tokenPrecision,
            ).toString();
            const expectedFeeAmount = bridgingCostInTokens + 1;
            await token.transfer(
              wallet.address,
              amount.add(expectedSendTxTokenFeeAmount),
            );

            // assert balance
            const response = await autoDepositFactory.swapAndBridge(
              wallet.address,
              token.address,
              nonce,
              messengerProtocol,
            );
            await recordTxPrice(testName, 'swapAndBridge', response);

            await expect(response)
              .to.emit(bridge, 'SwapAndBridgeEvent')
              .withArgs(
                addressToBytes32(token.address),
                amount,
                recipientAddressBytes,
                recipientChainId,
                recipientTokenAddressBytes,
                nonce,
                messengerProtocol,
                expectedFeeAmount,
                '0',
              );
          });
        });

        describe('createSwapAndBridge', () => {
          it('Success: createSwapAndBridge should create wallet and charge send fee and call bridge', async () => {
            const testName = 'createSwapAndBridge';

            const expectedSendTxTokenFeeAmount = parseUnits(
              '0.4',
              tokenPrecision,
            ).toString();
            const expectedFeeAmount = bridgingCostInTokens + 1;

            const {
              recipientChainId,
              bridgeAddress,
              recipientAddressBytes,
              recipientTokenAddressBytes,
              minDepositAmount,
            } = getWalletParams();

            const predictedWalletAddress =
              await autoDepositFactory.getDepositWalletAddress(
                recipientChainId,
                bridgeAddress,
                recipientAddressBytes,
                recipientTokenAddressBytes,
                minDepositAmount,
              );
            await token.transfer(
              predictedWalletAddress,
              amount.add(expectedSendTxTokenFeeAmount),
            );

            const response = await autoDepositFactory.createSwapAndBridge(
              recipientChainId,
              bridgeAddress,
              recipientAddressBytes,
              recipientTokenAddressBytes,
              minDepositAmount,
              token.address,
              nonce,
              messengerProtocol,
            );
            await recordTxPrice(testName, 'createSwapAndBridge', response);

            await expect(response)
              .to.emit(bridge, 'SwapAndBridgeEvent')
              .withArgs(
                addressToBytes32(token.address),
                amount,
                recipientAddressBytes,
                recipientChainId,
                recipientTokenAddressBytes,
                nonce,
                messengerProtocol,
                expectedFeeAmount,
                '0',
              );
          });

          it('Success: createSwapAndBridge should charge send fee and call bridge with pre-inited wallet and', async () => {
            const testName = 'createSwapAndBridge with pre-inited wallet';
            await initializeWallet({ testName });

            const expectedSendTxTokenFeeAmount = parseUnits(
              '0.4',
              tokenPrecision,
            ).toString();
            const expectedFeeAmount = bridgingCostInTokens + 1;

            const {
              recipientChainId,
              bridgeAddress,
              recipientAddressBytes,
              recipientTokenAddressBytes,
              minDepositAmount,
            } = getWalletParams();

            const predictedWalletAddress =
              await autoDepositFactory.getDepositWalletAddress(
                recipientChainId,
                bridgeAddress,
                recipientAddressBytes,
                recipientTokenAddressBytes,
                minDepositAmount,
              );
            await token.transfer(
              predictedWalletAddress,
              amount.add(expectedSendTxTokenFeeAmount),
            );

            const response = await autoDepositFactory.createSwapAndBridge(
              recipientChainId,
              bridgeAddress,
              recipientAddressBytes,
              recipientTokenAddressBytes,
              minDepositAmount,
              token.address,
              nonce,
              messengerProtocol,
            );
            await recordTxPrice(testName, 'createSwapAndBridge', response);

            await expect(response)
              .to.emit(bridge, 'SwapAndBridgeEvent')
              .withArgs(
                addressToBytes32(token.address),
                amount,
                recipientAddressBytes,
                recipientChainId,
                recipientTokenAddressBytes,
                nonce,
                messengerProtocol,
                expectedFeeAmount,
                '0',
              );
          });
        });
      });

      describe('Admin methods', () => {
        describe('setSendTxCost', () => {
          const amount = parseUnits('0.0001', chainPrecision);

          it('Success: should set cost of send tx', async () => {
            await autoDepositFactory.setSendTxCost(amount);
            expect(await autoDepositFactory.sendTxCost()).to.eq(amount);
          });

          it('Failure: should revert when the caller is not the owner', async () => {
            await expect(
              autoDepositFactory.connect(alice).setSendTxCost(amount),
            ).revertedWith('Ownable: caller is not the owner');
          });
        });
      });
    });
  }
});
/* ------ LOG UTILS ------- */
type SummaryEntry = {
  calls: number;
  gasUsed: BigNumber;
};

const txSummary: Record<string, Record<string, SummaryEntry>> = {};

async function recordTxPrice(
  testName: string,
  name: string,
  tx: ContractTransaction,
) {
  const receipt = await tx.wait();
  _recordTx(testName, name, receipt.gasUsed);
}

function _recordTx(testName: string, name: string, gasUsed: BigNumber) {
  if (!txSummary[testName]) {
    txSummary[testName] = {};
    txSummary[testName][name] = {
      calls: 0,
      gasUsed: ethers.BigNumber.from(0),
    };
  } else if (!txSummary[testName][name]) {
    txSummary[testName][name] = {
      calls: 0,
      gasUsed: ethers.BigNumber.from(0),
    };
  }

  txSummary[testName][name].calls += 1;
  txSummary[testName][name].gasUsed =
    txSummary[testName][name].gasUsed.add(gasUsed);
}

function _printTxSummary() {
  const testNames = Object.keys(txSummary);
  if (testNames.length === 0) {
    console.log('Tx summary: no transactions recorded');
    return;
  }

  console.log('--- AutoDepositFactory Tx summary ---');
  let grandTotalGas = BigNumber.from(0);
  let grandTotalCalls = 0;

  for (const testName of testNames) {
    console.log(`Test: ${testName}`);
    const entries = txSummary[testName];
    let testTotalGas = BigNumber.from(0);
    let testTotalCalls = 0;

    for (const txName of Object.keys(entries)) {
      const entry = entries[txName];
      const avgGas =
        entry.calls > 0 ? entry.gasUsed.div(entry.calls) : BigNumber.from(0);

      testTotalGas = testTotalGas.add(avgGas);
      testTotalCalls += entry.calls;

      console.log(
        `  ${txName}: avgGas=${avgGas.toString()} (calls=${entry.calls})`,
      );
    }

    grandTotalGas = grandTotalGas.add(testTotalGas);
    grandTotalCalls += testTotalCalls;

    console.log(
      `  Test totals: gas=${testTotalGas.toString()}`,
    );
  }
}

process.on('beforeExit', _printTxSummary);
process.on('exit', _printTxSummary);
process.on('SIGINT', () => {
  _printTxSummary();
  process.exit();
});
