import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { Big } from 'big.js';

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const cctpBridge = await ethers.getContractAt(
    'CctpBridge',
    cctpBridgeAddress,
  );

  const currentFeeBp = await cctpBridge.adminFeeShareBP();
  const feeBP = getEnv('CCTP_FEE_BP');
  console.log('Current Fee BP:', currentFeeBp.toString());
  console.log('New Fee BP:', feeBP);

  if (!Big(currentFeeBp.toString()).eq(feeBP)) {
    const result = await cctpBridge.setAdminFeeShare(feeBP);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
