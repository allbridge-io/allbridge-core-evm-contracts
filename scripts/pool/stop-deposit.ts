import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const poolAddress = process.env.POOL_ADDRESS;
  if (!poolAddress) {
    throw new Error('No pool address');
  }

  const contract = await ethers.getContractAt('Pool', poolAddress);
  const result = await contract.stopDeposit();
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
