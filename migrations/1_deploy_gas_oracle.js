const GasOracle = artifacts.require('./GasOracle.sol');

const CHAIN_PRECISION = 6;

module.exports = function(deployer) {
  const chainId = process.env.CHAIN_ID ? +process.env.CHAIN_ID : undefined;
  if (!chainId) {
    throw new Error('No chain id');
  }
  deployer.deploy(GasOracle, chainId, CHAIN_PRECISION);
};
