const { callContract, getContract } = require('../../helper');

(async function () {
  const autoDepositFactoryAddress = process.env.AUTO_DEPOSIT_FACTORY_ADDRESS;
  if (!autoDepositFactoryAddress) {
    throw new Error('No auto deposit factory address');
  }

  const tokenAddresses = [
    'TEYM56Hk4554u8ge4vNLZcE59pv7GQy1tv',
    'TEwnUeq4d2oZRtg9x7ZdZgqJhMpYzpAtLp',
  ];
  const tokensToRegister = tokenAddresses.filter(async (token) => {
    const isAccepted = await getContract("AutoDepositFactory", autoDepositFactoryAddress, "acceptedTokens", token);
    return !isAccepted;
  });

  if (tokensToRegister.length === 0) {
    console.log('Nothing to register');
    return;
  }

  for (const tokenAddress of tokensToRegister) {
    console.log(`Register token ${tokenAddress}`);
    const result = await callContract(
      'AutoDepositFactory',
      autoDepositFactoryAddress,
      'registerToken',
      tokenAddress,
    );
    console.log(result);
  }
})();
