import { ethers } from 'hardhat';
import {
  addressToBytes32,
  getEnv,
  handleTransactionResult,
  solanaAddressToBytes32,
  sorobanAddressToBytes32,
  SRB_CHAIN_ID,
} from '../helper';

// https://developers.circle.com/cctp/references/contract-addresses
// <networkName, [chainId, domain, otherCctpV2BridgeAddress]>
const map = new Map<string, [number, number, string]>();
// Testnet
map.set('Ethereum Sepolia', [
  2,
  0,
  addressToBytes32('0x23918E72531f4B6E7620E0dAF6EDcD83d3962543'),
]);
map.set('Avalanche Fuji', [
  9,
  1,
  addressToBytes32('0xa34EF47801EFAdf02f1BbB5c1ebC2B4e73209522'),
]);
map.set('Arbitrum Sepolia', [
  6,
  3,
  addressToBytes32('0xa34EF47801EFAdf02f1BbB5c1ebC2B4e73209522'),
]);
// map.set("Base Sepolia", [11, 6]);
map.set('Polygon PoS Amoy', [
  5,
  7,
  addressToBytes32('0xa34EF47801EFAdf02f1BbB5c1ebC2B4e73209522'),
]);
/* cSpell:disable */
const cctpV2BridgeAuthority = 'rucRLqMvNQnrPHcvbXW3hv64aN6CxJUaTBxFDFbSRY5';
/* cSpell:enable */
map.set('Solana Devnet', [4, 5, solanaAddressToBytes32(cctpV2BridgeAuthority)]);
/* cSpell:disable */
map.set('Stellar Testnet', [
  SRB_CHAIN_ID,
  27,
  sorobanAddressToBytes32(
    'CAYUCAP2ORC5PSASKC63MQGMB6X62YXDADCSPDBZNHHHG33GKNZUYROB',
  ),
]);
/* cSpell:enable */

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
  const cctpV2Bridge = await ethers.getContractAt(
    'CctpV2Bridge',
    cctpV2BridgeAddress,
  );

  for (const [name, entry] of map) {
    const [chainId, domain, otherCctpV2BridgeAddress] = entry;
    if (+currentChainId === chainId) continue;

    let currentDomain: number | undefined;
    let currentOtherBridge: string | undefined;

    try {
      currentDomain = await cctpV2Bridge.getDomainByChainId(chainId);
      currentOtherBridge = await cctpV2Bridge.otherBridges(chainId);
    } catch {
      // Not registered yet; fall through and submit the update.
    }

    if (
      shouldSkipBridgeDestinationRegistration(
        currentDomain,
        currentOtherBridge,
        domain,
        otherCctpV2BridgeAddress,
      )
    ) {
      console.log(`Skip ${name} (already registered)`);
      continue;
    }

    console.log(
      `Register ${name} (Chain ID: ${chainId} Domain: ${domain} CCTPv2 Bridge: ${otherCctpV2BridgeAddress})`,
    );
    const result = await cctpV2Bridge.registerBridgeDestination(
      chainId,
      domain,
      otherCctpV2BridgeAddress,
    );
    await handleTransactionResult(result);
  }
}

export function shouldSkipBridgeDestinationRegistration(
  currentDomain: number | undefined,
  currentBridgeAddress: string | undefined,
  expectedDomain: number,
  expectedBridgeAddress: string,
): boolean {
  if (currentDomain === undefined || currentBridgeAddress === undefined) {
    return false;
  }

  return (
    currentDomain === expectedDomain &&
    currentBridgeAddress.toLowerCase() === expectedBridgeAddress.toLowerCase()
  );
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
