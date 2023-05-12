const { callContract, tronAddressToBuffer32 } = require('./helper');

(async function () {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const poolAddress = process.env.POOL_ADDRESS;
  if (!poolAddress) {
    throw new Error('No bridge address');
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const result = await callContract(
    'Bridge',
    bridgeAddress,
    'addPool',
    poolAddress,
    tronAddressToBuffer32(tokenAddress),
  );
  console.log(result);
})();
