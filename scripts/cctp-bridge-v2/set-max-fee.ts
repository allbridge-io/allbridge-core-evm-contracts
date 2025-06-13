import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { Big } from 'big.js';

async function main() {
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', cctpV2BridgeAddress);

  const currentFee = await cctpV2Bridge.maxFeeShare();
  const fee = '';
  console.log('Current Fee:', currentFee.toString());
  console.log('New Fee:', fee);

  if (!Big(currentFee.toString()).eq(fee)) {
    const result = await cctpV2Bridge.setMaxFeeShare(fee);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
