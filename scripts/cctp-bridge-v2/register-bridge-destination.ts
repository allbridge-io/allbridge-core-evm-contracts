import { ethers } from 'hardhat';
import { addressToBytes32, getEnv, handleTransactionResult } from '../helper';

// https://developers.circle.com/cctp/references/contract-addresses
const map = new Map<string, [number, number, string]>();
// Testnet
map.set("Ethereum Sepolia", [2, 0, addressToBytes32('0x7f4050016B486C132b6d42Eb6CF5F5a26EfF4067')]);
map.set("Avalanche Fuji", [9, 1, addressToBytes32('0xcBf2A4207E3dB74611Ed6Efc77e07057c0F5328B')]);
map.set("Arbitrum Sepolia", [6, 3, addressToBytes32('0x3f4253b8B302BebBfA57a07F00EbfF4025FC0132')]);
// map.set("Base Sepolia", [11, 6]);
map.set("Polygon PoS Amoy", [5, 7, addressToBytes32('0x3562bC426c7C0D24C56268919c8FC1CC8f95991C')]);

// Mainnet
// map.set("Ethereum", [1, 0]);
// map.set("Avalanche", [8, 1]);
// map.set("Optimism", [10, 2]);
// map.set("Arbitrum", [6, 3]);
// map.set("Solana", [4, 5]);
// map.set("Base", [9, 6]);
// map.set("Polygon", [5, 7]);
// map.set("Unichain", [14, 10]);
// map.set("Linea", [17, 11]);
// map.set("Sonic", [12, 13]);

async function main() {
  const currentChainId = getEnv('CHAIN_ID');
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', cctpV2BridgeAddress);

  for (const [name, entry] of map) {
    const [chainId, domain, otherCctpV2BridgeAddress] = entry;
    if (+currentChainId === chainId) continue;

    console.log(`Register ${name} (Chain ID: ${chainId} Domain: ${domain} CCTPv2 Bridge: ${otherCctpV2BridgeAddress})`);
    const result = await cctpV2Bridge.registerBridgeDestination(chainId, domain, otherCctpV2BridgeAddress);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
