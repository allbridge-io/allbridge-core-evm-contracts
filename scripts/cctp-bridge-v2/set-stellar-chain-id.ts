import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult, SRB_CHAIN_ID } from '../helper';

// Set to 0 to disable bridging to Stellar
const stellarChainId = SRB_CHAIN_ID;

async function main() {
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt(
    'CctpV2Bridge',
    cctpV2BridgeAddress,
  );

  const currentStellarChainId = await cctpV2Bridge.stellarChainId();
  if (currentStellarChainId.eq(stellarChainId)) {
    console.log(`Stellar chain ID is already ${stellarChainId}`);
    return;
  }

  console.log(`Set Stellar chain ID to ${stellarChainId}`);
  const result = await cctpV2Bridge.setStellarChainId(stellarChainId);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
