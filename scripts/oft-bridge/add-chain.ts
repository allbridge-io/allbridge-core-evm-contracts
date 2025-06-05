import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const oftBridgeAddress = process.env.OFT_BRIDGE_ADDRESS;
  if (!oftBridgeAddress) {
    throw new Error('No oft bridge address');
  }

  const tokenAddress = process.env.OFT_TOKEN;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const contract = await ethers.getContractAt('OftBridge', oftBridgeAddress);
  // const result = await contract.registerBridgeDestination(6, 40231, 20000); // ARB
  // const result = await contract.registerBridgeDestination(9, 40106, 20000); // AVA
  const result = await contract.registerBridgeDestination(2, 40161, 20000); // SPL
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
