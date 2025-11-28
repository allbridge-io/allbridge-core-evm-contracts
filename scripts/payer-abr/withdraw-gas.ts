import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatEther } from 'ethers/lib/utils';

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');

  const currentBalance = await ethers.provider.getBalance(contractAddress);
  console.log(`Payer balance is ${formatEther(currentBalance)}`);
  if (currentBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }
  console.log(`Withdraw from the Payer contract ${formatEther(currentBalance)}`);
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const result = await contract.withdrawGas(currentBalance);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
