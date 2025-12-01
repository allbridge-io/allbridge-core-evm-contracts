import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits } from 'ethers/lib/utils';
import { BigNumber } from 'ethers';

async function main() {
  const autoDepositWalletAddress = getEnv('AUTO_DEPOSIT_WALLET');
  const tokenAddress = getEnv('TOKEN_ADDRESS');

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

  const walletContract = await ethers.getContractAt('AutoDepositWallet', autoDepositWalletAddress);
  let minDepositAmount = await walletContract.minDepositTokenAmount(tokenAddress);
  if (minDepositAmount.eq(0)) {
    console.log(`Token ${tokenSymbol} (${tokenAddress}) is not registered with the wallet ${autoDepositWalletAddress}`);
    minDepositAmount = BigNumber.from((await walletContract.minDepositAmount()).toNumber() * 10 ** Number(tokenDecimals));
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
  const txRes = await tokenContract.transfer(autoDepositWalletAddress, amount);
  await handleTransactionResult(txRes);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
