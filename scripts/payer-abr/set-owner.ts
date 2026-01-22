import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const newOwner = getEnv('OWNER');
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const result = await contract.transferOwnership(newOwner);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
