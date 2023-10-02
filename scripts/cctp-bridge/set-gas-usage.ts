import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const map = new Map<string, [number, number]>();
map.set("Ethereum", [1, 200_000]);
map.set("Arbitrum", [6, 200_000]);

async function main() {
  const currentChainId = getEnv('CHAIN_ID');
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);

  for (const [name, entry] of map) {
    const [destinationChainId, gasAmount] = entry;
    if (+currentChainId === destinationChainId) continue;
    console.log(`Set gas usage of transaction on ${name} (Chain ID: ${destinationChainId} Gas usage: ${gasAmount})`);
    const currentGasUsage = await cctpBridge.gasUsage(destinationChainId);
    if (currentGasUsage.eq(gasAmount)) {
      console.log('Nothing to change');
      continue;
    }
    const result = await cctpBridge.setGasUsage(destinationChainId, gasAmount);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
