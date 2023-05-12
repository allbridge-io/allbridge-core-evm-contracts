const {
  callContract,
  getContract,
  tronAddressToBuffer32,
  getSignerAddress,
} = require('./helper');
(async function () {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const poolAddress = await getContract(
    'Bridge',
    bridgeAddress,
    'pools',
    tronAddressToBuffer32(tokenAddress),
  );

  const signerAddress = getSignerAddress();

  const amount =
    '1' + '0'.repeat(await getContract('Token', tokenAddress, 'decimals'));

  const allowance = await getContract(
    'Token',
    tokenAddress,
    'allowance',
    signerAddress,
    poolAddress,
  );

  if (+allowance === 0) {
    console.log('Approving');
    console.log(
      await callContract(
        'Token',
        tokenAddress,
        'approve',
        poolAddress,
        '1000000000' + '0'.repeat(18),
      ),
    );
  }

  const result = await callContract(
    'Bridge',
    bridgeAddress,
    'swap',
    amount,
    tronAddressToBuffer32(tokenAddress),
    tronAddressToBuffer32('TYjmrhFaFMNKE8RheRUCQUWJHpRbY8Q9zy'),
    signerAddress,
  );
  console.log(result);
})();
