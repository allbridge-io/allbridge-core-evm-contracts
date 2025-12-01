const { loadSolSource, assertDoesNotContainSafeERC20 } = require('../scripts/utils/code-asserts');
const Contract = artifacts.require('./AutoDepositFactory.sol');

const CHAIN_PRECISION = 6;

module.exports = function (deployer) {
  const autoDepositFactorySource = loadSolSource('AutoDepositFactory');
  assertDoesNotContainSafeERC20(autoDepositFactorySource);

  const chainId = process.env.CHAIN_ID ? +process.env.CHAIN_ID : undefined;
  if (!chainId) {
    throw new Error('No chain id');
  }

  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address address');
  }

  deployer.deploy(
    Contract,
    chainId,
    CHAIN_PRECISION,
    gasOracleAddress,
    "0x41",
  );
};
