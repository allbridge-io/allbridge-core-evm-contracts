import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const xReserveBridgeAddress = getEnv('X_RESERVE_BRIDGE_ADDRESS');
  const newOwner = "0x";

  const contract = await ethers.getContractAt('XReserveBridge', xReserveBridgeAddress);
  console.log(`Setting new owner: ${newOwner}`);
  const result = await contract.transferOwnership(newOwner);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
