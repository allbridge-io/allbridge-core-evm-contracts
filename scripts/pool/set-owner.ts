import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const poolAddress = getEnv('POOL_ADDRESS');
  const owner = getEnv('OWNER');
  const contract = await ethers.getContractAt('Pool', poolAddress);
  const currentOwner = await contract.owner();
  if (currentOwner !== owner) {
    const result = await contract.transferOwnership(owner);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
