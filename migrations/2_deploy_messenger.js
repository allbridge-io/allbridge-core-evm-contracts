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

  const primaryValidator = process.env.PRIMARY_VALIDATOR_ADDRESS;
  if (!primaryValidator) {
    throw new Error('No primary validator');
  }

  const secondaryValidators = JSON.parse(process.env.SECONDARY_VALIDATOR_ADDRESSES || 'null');
  if (!secondaryValidators) {
    throw new Error('No secondary validators');
  }

  const otherChainIds = Buffer.from([
    0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);
  otherChainIds[chainId] = 0;

  deployer.deploy(
    Contract,
    chainId,
    otherChainIds,
    gasOracleAddress,
    primaryValidator,
    secondaryValidators,
  );
};
