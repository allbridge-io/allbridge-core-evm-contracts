import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const poolAddress = getEnv('POOL_ADDRESS');
  const newOwner = getEnv('OWNER');
  const contract = await ethers.getContractAt('Pool', poolAddress);
  const currentOwner = await contract.owner();
  if (currentOwner !== newOwner) {
    const result = await contract.transferOwnership(newOwner);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
