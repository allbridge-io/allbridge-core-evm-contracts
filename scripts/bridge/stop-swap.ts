import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const result = await contract.stopSwap();
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
