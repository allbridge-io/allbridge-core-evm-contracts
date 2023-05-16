const { callContract } = require('./helper');
(async function () {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const stableSwapAddress = process.env.STABLE_SWAP_ADDRESS;
  if (!stableSwapAddress) {
    throw new Error('No stable swap address');
  }
  const tokenAddress = 'TCH5u2poB9qdCKaPm9jULPetgpLxNsvAAA';

  const result = await callContract(
    'Bridge',
    bridgeAddress,
    'receiveTokens',
    '1002980481',
    Buffer.from(
      '41d5677adbe65ca6ae2235dbdfb75c4bef4ae84f000000000000000000000000',
      'hex',
    ),
    1,
    1,
    123,
    0,
  );
  console.log(result);
})();
