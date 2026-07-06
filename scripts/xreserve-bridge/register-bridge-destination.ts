import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const xReserveBridgeAddress = getEnv('X_RESERVE_BRIDGE_ADDRESS');

  const destinationChainId = 16;
  const destinationDomain = 10003;

  const contract = await ethers.getContractAt('XReserveBridge', xReserveBridgeAddress);
  console.log(`Registering bridge destination: chainId ${destinationChainId}, domain ${destinationDomain}`);
  const result = await contract.registerBridgeDestination(destinationChainId, destinationDomain);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
