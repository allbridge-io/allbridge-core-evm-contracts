import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const TARGET_ID = 8;

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);

  const registeredTarget = await contract.targets(TARGET_ID);
  if (registeredTarget.target === ethers.constants.AddressZero) {
    console.log(`Target ${TARGET_ID} is not registered. Skip sending transaction.`);
    return;
  }

  console.log(`Unregister target ${TARGET_ID}`);
  const result = await contract.unregisterTarget(TARGET_ID);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
