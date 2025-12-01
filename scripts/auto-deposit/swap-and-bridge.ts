import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits } from 'ethers/lib/utils';

async function main() {
  const autoDepositFactoryAddress = getEnv('AUTO_DEPOSIT_FACTORY');
  const autoDepositWalletAddress = getEnv('AUTO_DEPOSIT_WALLET');

  const contract = await ethers.getContractAt('AutoDepositFactory', autoDepositFactoryAddress);
  const walletContract = await ethers.getContractAt('AutoDepositWallet', autoDepositWalletAddress);

  const tokenAddress = getEnv('TOKEN_ADDRESS');
  const messengerProtocol = 1;

  const tokenContract = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    tokenAddress,
  );
  const tokenDecimals = await tokenContract.decimals();
  const tokenSymbol = await tokenContract.symbol();
  const tokensBalance = await tokenContract.balanceOf(autoDepositWalletAddress);
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

  const recipientChainId = await walletContract.recipientChainId();
  const bridgeAddress = await walletContract.bridge();
  const bridgeContract = await ethers.getContractAt('Bridge', bridgeAddress);
  const feeTokenAmount = await bridgeContract.getBridgingCostInTokens(recipientChainId, messengerProtocol, tokenAddress);
  console.log(
    `Bridging fee is ${formatUnits(
      feeTokenAmount,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );

  const sendTxFeeTokenAmount = await contract.getSendTxFeeTokenAmount(tokenAddress);
  console.log(
    `Send tx fee is ${formatUnits(
      sendTxFeeTokenAmount,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );

  const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));
  const result = await contract.swapAndBridge(
    autoDepositWalletAddress,
    tokenAddress,
    nonce,
    messengerProtocol,
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
