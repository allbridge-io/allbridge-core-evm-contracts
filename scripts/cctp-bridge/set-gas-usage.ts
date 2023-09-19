import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const destinationChainId = 6;
const gasAmount = 1_000_000_000;

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);

  const result = await cctpBridge.setGasUsage(destinationChainId, gasAmount);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
