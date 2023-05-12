import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const poolAddress = process.env.POOL_ADDRESS;
  if (!poolAddress) {
    throw new Error('No bridge address');
  }

  const pool = await ethers.getContractAt('Pool', poolAddress);
  const token = await ethers.getContractAt('Token', await pool.token());
  await handleTransactionResult(
    await token.approve(pool.address, ethers.constants.MaxUint256),
  );

  await handleTransactionResult(
    await pool.deposit('100000' + '0'.repeat(await token.decimals())),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
