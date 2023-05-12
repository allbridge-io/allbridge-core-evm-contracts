import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

// solana = 0.000005 fee + 0.001392 lock + 0.00203928 user token = 0.0034362 ≈ 3500 klamports (1000 lamport)

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const result = await contract.setGasUsage(5, 3500);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
