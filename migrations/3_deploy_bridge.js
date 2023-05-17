const {loadSolSource, assertDoesNotContainSafeERC20} = require('../scripts/utils/code-asserts');
const Contract = artifacts.require('./Bridge.sol');

const CHAIN_PRECISION = 6;

module.exports = function (deployer) {
  const routerSource = loadSolSource('Router');
  const bridgeSource = loadSolSource('Bridge');
  const gasUsageSource = loadSolSource('GasUsage');
  const messengerGatewaySource = loadSolSource('MessengerGateway');
  assertDoesNotContainSafeERC20(routerSource);
  assertDoesNotContainSafeERC20(bridgeSource);
  assertDoesNotContainSafeERC20(gasUsageSource);
  assertDoesNotContainSafeERC20(messengerGatewaySource);

  const chainId = process.env.CHAIN_ID ? +process.env.CHAIN_ID : undefined;
  if (!chainId) {
    throw new Error('No chain id');
  }

  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address address');
  }

  const zeroAddress = 'T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb';

  deployer.deploy(
    Contract,
    chainId,
    CHAIN_PRECISION,
    messengerAddress,
    zeroAddress,
    gasOracleAddress,
  );
};
