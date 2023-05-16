const { callContract } = require('./helper');

(async function () {
  const tokenAddress = process.env.TOKEN_ADDRESS;
  const spenderAddress = process.env.POOL_ADDRESS;
  const result = await callContract(
    'Token',
    tokenAddress,
    'approve',
    spenderAddress,
    '1000000000000' + '0'.repeat(18),
  );
  console.log(result);
})();
