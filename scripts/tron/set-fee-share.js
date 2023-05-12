const { callContract, tronAddressToBuffer32 } = require('./helper');

(async function () {

  const poolAddress = process.env.POOL_ADDRESS;
  if (!poolAddress) {
    throw new Error('No bridge address');
  }

  const result = await callContract(
    'Pool',
    poolAddress,
    'setFeeShare',
    5,
  );
  console.log(result);
})();
