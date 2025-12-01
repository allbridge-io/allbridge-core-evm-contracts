const { callContract, getContract } = require('../../helper');
const { formatUnits } = require('ethers/lib/utils');
const { BigNumber } = require('ethers');
const { randomBytes } = require('crypto');

(async function () {
  const autoDepositFactoryAddress = process.env.AUTO_DEPOSIT_FACTORY_ADDRESS;
  if (!autoDepositFactoryAddress) {
    throw new Error('No auto deposit factory address');
  }
  const autoDepositWalletAddress = process.env.AUTO_DEPOSIT_WALLET_ADDRESS;
  if (!autoDepositWalletAddress) {
    throw new Error('No auto deposit wallet address');
  }
  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const messengerProtocol = 1;

  const tokenDecimals = await getContract("ERC20", tokenAddress, "decimals");
  const tokenSymbol = await getContract("ERC20", tokenAddress, "symbol");
  const tokensBalance = await getContract("ERC20", tokenAddress, "balanceOf", autoDepositWalletAddress);
  console.log(
    `Wallet token balance is ${formatUnits(
      tokensBalance,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );
  if (tokensBalance.isZero()) {
    console.log(`Nothing to bridge`);
    return;
  }

  const recipientChainId = await getContract("AutoDepositWallet", autoDepositWalletAddress, "recipientChainId");
  const bridgeAddress = await getContract("AutoDepositWallet", autoDepositWalletAddress, "bridge");
  const feeTokenAmount = await getContract(
    "Bridge",
    bridgeAddress,
    "getBridgingCostInTokens",
    recipientChainId,
    messengerProtocol,
    tokenAddress,
  );
  console.log(
    `Bridging fee is ${formatUnits(
      feeTokenAmount,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );

  const sendTxFeeTokenAmount = await getContract("AutoDepositFactory", autoDepositFactoryAddress, "getSendTxFeeTokenAmount", tokenAddress);
  console.log(
    `Send tx fee is ${formatUnits(
      sendTxFeeTokenAmount,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );
  const nonce = BigNumber.from(randomBytes(32));

  const result = await callContract(
    'AutoDepositFactory',
    autoDepositFactoryAddress,
    'swapAndBridge',
    autoDepositWalletAddress,
    tokenAddress,
    nonce,
    messengerProtocol,
  );
  console.log(result);
})();
