const { callContract, getContract } = require('../../helper');
const { formatUnits } = require('ethers/lib/utils');
const { BigNumber } = require('ethers');

(async function () {
  const autoDepositWalletAddress = process.env.AUTO_DEPOSIT_WALLET_ADDRESS;
  if (!autoDepositWalletAddress) {
    throw new Error('No auto deposit wallet address');
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }
  const tokenDecimals = await getContract("ERC20", tokenAddress, "decimals");
  const tokenSymbol = await getContract("ERC20", tokenAddress, "symbol");
  const tokensBalance = await getContract("ERC20", tokenAddress, "balanceOf", autoDepositWalletAddress);
  console.log(
    `Wallet token balance is ${formatUnits(
      tokensBalance,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );

  let { minDepositAmount } = await getContract("AutoDepositWallet", autoDepositWalletAddress, "minDepositTokenAmount", tokenAddress);
  if (minDepositAmount.isZero()) {
    console.log(`Token ${tokenSymbol} (${tokenAddress}) is not registered with the wallet ${autoDepositWalletAddress}`);
    const minAmount = await getContract("AutoDepositWallet", autoDepositWalletAddress, "minDepositAmount");
    minDepositAmount = BigNumber.from(minAmount.toNumber() * 10 ** Number(tokenDecimals));
  }
  console.log(
    `Wallet min deposit is ${formatUnits(
      minDepositAmount,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );
  const amount = minDepositAmount.mul(2);
  console.log(`Transfer ${formatUnits(
    amount,
    tokenDecimals,
  )} ${tokenSymbol} to the wallet ${autoDepositWalletAddress}`);

  const result = await callContract(
    'ERC20',
    tokenAddress,
    'transfer',
    autoDepositWalletAddress,
    amount,
  );
  console.log(result);
})();
