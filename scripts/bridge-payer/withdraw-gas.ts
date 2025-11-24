import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatEther } from 'ethers/lib/utils';

async function main() {
  const contractAddress = getEnv('BRIDGE_PAYER_ADDRESS');

  const currentBalance = await ethers.provider.getBalance(contractAddress);
  console.log(`Bridge Payer balance is ${formatEther(currentBalance)}`);
  if (currentBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }
  console.log(`Withdraw from the Bridge Payer contract ${formatEther(currentBalance)}`);
  const contract = await ethers.getContractAt('BridgePayerWithToken', contractAddress);
  const result = await contract.withdrawGas(currentBalance);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
