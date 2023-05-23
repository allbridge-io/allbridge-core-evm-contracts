import { ethers } from 'hardhat';
import { getRequiredEnvVariable, handleTransactionResult } from '../helper';
import { formatEther } from 'ethers/lib/utils';

async function main() {
  const messengerAddress = getRequiredEnvVariable('MESSENGER_ADDRESS');
  const contract = await ethers.getContractAt('Messenger', messengerAddress);

  const currentBalance = await ethers.provider.getBalance(messengerAddress);
  console.log(`Bridge balance is ${formatEther(currentBalance)}`);
  if (currentBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }
  console.log(`Withdraw from the Bridge contract ${formatEther(currentBalance)}`);
  await handleTransactionResult(await contract.withdrawGasTokens(currentBalance));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
