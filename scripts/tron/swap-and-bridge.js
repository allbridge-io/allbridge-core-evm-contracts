const { callContract, tronAddressToBuffer32 } = require('./helper');
(async function () {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const result = await callContract(
    'Bridge',
    bridgeAddress,
    'swapAndBridge',
    tronAddressToBuffer32(tokenAddress),
    '1' + '0'.repeat(18),
    '0x000000000000000000000000be959eed208225aab424505569d41bf3212142c0',
    2,
    '0x000000000000000000000000c7dbc4a896b34b7a10dda2ef72052145a9122f43',
    103,
    1,
  );
  console.log(result);
})();
