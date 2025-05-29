import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const oftBridgeAddress = process.env.OFT_BRIDGE_ADDRESS;
  if (!oftBridgeAddress) {
    throw new Error('No oft bridge address');
  }

  const contract = await ethers.getContractAt('OftBridge', oftBridgeAddress);

  const result = await contract.setLzGasLimit(9, 200000);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
