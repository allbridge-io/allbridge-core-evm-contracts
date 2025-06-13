import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { Big } from 'big.js';

async function main() {
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', cctpV2BridgeAddress);

  const currentThreshold = await cctpV2Bridge.minFinalityThreshold();
  const threshold = '';
  console.log('Current threshold:', currentThreshold.toString());
  console.log('New threshold:', threshold);

  if (!Big(currentThreshold.toString()).eq(threshold)) {
    const result = await cctpV2Bridge.setMinFinalityThreshold(threshold);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
