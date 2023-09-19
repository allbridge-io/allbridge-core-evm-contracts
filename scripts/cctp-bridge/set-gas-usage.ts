import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);

  const result = await cctpBridge.setGasUsage(6, 1000);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
