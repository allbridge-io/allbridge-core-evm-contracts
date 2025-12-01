import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatEther, parseEther } from 'ethers/lib/utils';

async function main() {
  const autoDepositFactoryAddress = getEnv('AUTO_DEPOSIT_FACTORY');
  const contract = await ethers.getContractAt(
    'AutoDepositFactory',
    autoDepositFactoryAddress,
  );

  const currentCost = await contract.sendTxCost();
  console.log(`Current send tx cost is ${formatEther(currentCost)}`);

  const newCost = parseEther('0.0002'); //TODO replace with another chain gas price
  console.log(`New send tx cost is     ${formatEther(newCost)}`);

  if (newCost.eq(currentCost)) {
    console.log('Nothing to update');
    return;
  }
  const result = await contract.setSendTxCost(newCost);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
