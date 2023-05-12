const { callContract } = require('./helper');
(async function () {
  const poolAddress = process.env.POOL_ADDRESS;
  if (!poolAddress) {
    throw new Error('No pool address');
  }

  const result = await callContract(
    'Pool',
    poolAddress,
    'deposit',
    '100000' + '0'.repeat(18),
  );
  console.log(result);
})();
