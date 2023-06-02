const { callContract, getContract } = require('../helper');
(async function () {
  const poolAddress = process.env.POOL_ADDRESS;
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!poolAddress) {
    throw new Error('No pool address');
  }
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const decimals = await getContract('ERC20', tokenAddress, 'decimals');

  const result = await callContract(
    'Pool',
    poolAddress,
    'deposit',
    '100000' + '0'.repeat(+decimals),
  );
  console.log(result);
})();
