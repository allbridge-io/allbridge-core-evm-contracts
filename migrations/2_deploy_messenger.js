const Contract = artifacts.require('./Messenger.sol');

module.exports = function (deployer) {
  const chainId = process.env.CHAIN_ID ? +process.env.CHAIN_ID : undefined;
  if (!chainId) {
    throw new Error('No chain id');
  }

  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address');
  }

  const validator = process.env.VALIDATOR_ADDRESS;
  if (!validator) {
    throw new Error('No validator');
  }

  const otherChainIds = Buffer.from([
    0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);
  otherChainIds[chainId] = 0;

  deployer.deploy(
    Contract,
    chainId,
    otherChainIds,
    gasOracleAddress,
    validator,
    [validator],
  );
};
