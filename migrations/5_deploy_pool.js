const {loadSolSource, assertDoesNotContainSafeERC20} = require('../scripts/utils/code-asserts');
const Contract = artifacts.require('./Pool.sol');

module.exports = function (deployer) {
  const poolSource = loadSolSource('Pool');
  const rewardManagerSource = loadSolSource('RewardManager');
  assertDoesNotContainSafeERC20(poolSource);
  assertDoesNotContainSafeERC20(rewardManagerSource);

  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const lpTokenName = process.env.LP_TOKEN_NAME;
  const lpTokenSymbol = process.env.LP_TOKEN_SYMBOL;
  if (!lpTokenName || !lpTokenSymbol) {
    throw new Error('No LP token name or symbol');
  }

  deployer.deploy(
      Contract,
      bridgeAddress,
      20,
      tokenAddress,
      30,
      500,
      lpTokenName,
      lpTokenSymbol,
  );
};

// TCH5u2poB9qdCKaPm9jULPetgpLxNsvAAA
