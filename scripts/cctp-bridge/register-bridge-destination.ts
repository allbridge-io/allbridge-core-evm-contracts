import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const map = new Map<string, [number, number]>();
// https://developers.circle.com/stablecoin/docs/cctp-protocol-contract
map.set("Ethereum", [1, 0]);
// myMap.set("Avalanche", [, 1]);
// myMap.set("Optimism", [, 2]);
map.set("Arbitrum", [6, 3]);

async function main() {
  const currentChainId = getEnv('CHAIN_ID');
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);

  for (const [name, entry] of map) {
    const [chainId, domain] = entry;
    if (+currentChainId === chainId) continue;

    console.log(`Register ${name} (Chain ID: ${chainId} Domain: ${domain})`);
    const result = await cctpBridge.registerBridgeDestination(chainId, domain);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
