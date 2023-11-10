import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const owner = getEnv('OWNER');
  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);
  const currentOwner = await cctpBridge.owner();
  if (currentOwner !== owner) {
    const result = await cctpBridge.transferOwnership(owner);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
