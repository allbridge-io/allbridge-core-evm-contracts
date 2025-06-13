import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { Big } from 'big.js';

async function main() {
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', cctpV2BridgeAddress);

  const currentFeeBp = await cctpV2Bridge.adminFeeShareBP();
  const feeBP = getEnv('CCTP_FEE_BP');
  console.log('Current Fee BP:', currentFeeBp.toString());
  console.log('New Fee BP:', feeBP);

  if (!Big(currentFeeBp.toString()).eq(feeBP)) {
    const result = await cctpV2Bridge.setAdminFeeShare(feeBP);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
