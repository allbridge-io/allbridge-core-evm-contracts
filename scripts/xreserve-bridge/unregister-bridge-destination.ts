import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const xReserveBridgeAddress = getEnv('X_RESERVE_BRIDGE_ADDRESS');
  const destinationChainId = process.env.DEST_CHAIN_ID || 16;

  const contract = await ethers.getContractAt('XReserveBridge', xReserveBridgeAddress);
  console.log(`Unregistering bridge destination: chainId ${destinationChainId}`);
  const result = await contract.unregisterBridgeDestination(destinationChainId);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
