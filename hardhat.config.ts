import * as dotenv from 'dotenv';

import { HardhatUserConfig } from 'hardhat/config';
import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';
import 'hardhat-abi-exporter';
import 'hardhat-ignore-warnings';

import './tasks/accounts';

const network = getNetwork();
dotenv.config({ path: network ? `.env.${network}` : '.env' });

const baseNetwork = {
  url: process.env.NODE_URL || '',
  accounts:
    process.env.PRIVATE_KEY !== undefined
      ? [process.env.PRIVATE_KEY]
      : undefined,
  timeout: 60000,
};

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 1000,
        details: {
          yulDetails: {
            optimizerSteps: "u",
          },
        },
      },
      outputSelection: {
        '*': {
          '*': ['storageLayout'],
        },
      },
    },
  },
  networks: {
    goerli: baseNetwork,
    mumbai: baseNetwork,
    sepolia: baseNetwork,
    holesky: baseNetwork,
    bsc: baseNetwork,
    arbitrumGoerli: baseNetwork,
  },
  gasReporter: {
    enabled: !!process.env.NODE_GAS,
    currency: 'USD',
  },
  abiExporter: [
    {
      path: 'artifacts/abi',
      runOnCompile: false,
      flat: true,
      only: [
        ':ERC20$',
        ':GasOracle$',
        ':Router$',
        ':Bridge$',
        ':Pool$',
        ':Messenger$',
        ':WormholeMessenger$',
        ':CctpBridge$',
      ],
    },
  ],
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY,
  },
  warnings: {
    '*': {
      unreachable: 'off',
      default: 'warn',
    },
    'contracts/test/**/*': {
      default: 'off',
    },
  },
};

export default config;

function getNetwork() {
  const keyIndex = process.argv.indexOf('--network');
  if (keyIndex >= 0) {
    return process.argv[keyIndex + 1];
  }
}
