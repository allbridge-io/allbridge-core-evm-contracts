const Contract = artifacts.require('./Token.sol');

module.exports = function (deployer) {
  const name = 'Yaroslav Stable Token';
  const symbol = 'USDY';
  const amount = '1000000000' + '0'.repeat(18);

  deployer.deploy(Contract, name, symbol, amount, 18);
};

// USDY TCLcBkhyedM31LXZnX6tFg7zzS3X19G3dX
