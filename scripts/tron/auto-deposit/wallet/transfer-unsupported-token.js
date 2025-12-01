const { callContract } = require('../../helper');

(async function () {
  const autoDepositWalletAddress = process.env.AUTO_DEPOSIT_WALLET_ADDRESS;
  if (!autoDepositWalletAddress) {
    throw new Error('No auto deposit wallet address');
  }

  const token = process.env.UNSUPPORTED_TOKEN;
  if (!token) {
    throw new Error('No token address');
  }

  const recipient = process.env.UNSUPPORTED_TOKEN_RECIPIENT;
  if (!recipient) {
    throw new Error('No recipient address');
  }

  const result = await callContract(
    'AutoDepositWallet',
    autoDepositWalletAddress,
    'transferUnsupportedToken',
    token,
    recipient,
  );
  console.log(result);
})();
