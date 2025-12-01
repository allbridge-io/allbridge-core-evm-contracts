import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const anotherChainId = 2; //TODO replace with another chain id
  const autoDepositFactoryAddress = getEnv('AUTO_DEPOSIT_FACTORY');
  const contract = await ethers.getContractAt(
    'AutoDepositFactory',
    autoDepositFactoryAddress,
  );

  const gasUsage = await contract.gasUsage(anotherChainId);
  console.log(`Current gas usage is ${gasUsage}`);

  const newGasUsage = 200; //TODO replace with another chain gas usage
  console.log(`New gas usage is     ${newGasUsage}`);

  if (gasUsage.eq(newGasUsage)) {
    console.log('Nothing to update');
    return;
  }
  const result = await contract.setGasUsage(anotherChainId, newGasUsage);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
