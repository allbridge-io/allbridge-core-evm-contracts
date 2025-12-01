const { callContract, getContract } = require('../../helper');

(async function () {
  const autoDepositWalletAddress = process.env.AUTO_DEPOSIT_WALLET_ADDRESS;
  if (!autoDepositWalletAddress) {
    throw new Error('No auto deposit wallet address');
  }

  const tokenAddresses = [
    '0x97034742DF00C506Bd8b9F90e51330bf91ea59b4',
    '0xac7d9D0cc7da68F704A229a7258DC2ba654fFcBC',
  ]; //TODO replace with another chain tokens
  const tokensToRegister = tokenAddresses.filter(async (token) => {
    const minAmount = await getContract("AutoDepositWallet", autoDepositWalletAddress, "minDepositTokenAmount", token);
    return minAmount.isZero();
  });

  if (tokensToRegister.length === 0) {
    console.log('Nothing to register');
    return;
  }

  if (tokensToRegister.length === 1) {
    console.log(`Register token ${tokensToRegister[0]}`);
    const result = await callContract(
      'AutoDepositWallet',
      autoDepositWalletAddress,
      'registerToken',
      tokensToRegister[0],
    );
    console.log(result);
    return;
  }

  console.log(`Register tokens ${tokensToRegister.join(",")}`);
  const result = await callContract(
    'AutoDepositWallet',
    autoDepositWalletAddress,
    'registerTokens',
    tokensToRegister,
  );
  console.log(result);
})();
