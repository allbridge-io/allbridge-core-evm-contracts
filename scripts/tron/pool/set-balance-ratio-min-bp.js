const { callContract } = require('../helper');

(async function () {

  const poolAddress = process.env.POOL_ADDRESS;
  if (!poolAddress) {
    throw new Error('No pool address');
  }

  const result = await callContract(
    'Pool',
    poolAddress,
    'setBalanceRatioMinBP',
    500,
  );
  console.log(result);
})();
