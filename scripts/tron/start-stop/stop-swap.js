const { callContract } = require('./../helper');

(async function () {

  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const result = await callContract(
    'Bridge',
    bridgeAddress,
    'stopSwap'
  );
  console.log(result);
})();
