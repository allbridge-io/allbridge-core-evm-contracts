import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const xReserveBridgeAddress = getEnv('X_RESERVE_BRIDGE_ADDRESS');
  const adminFeeShareBP = process.env.ADMIN_FEE_SHARE_BP || '100';

  const contract = await ethers.getContractAt('XReserveBridge', xReserveBridgeAddress);
  console.log(`Setting admin fee share: ${adminFeeShareBP} BP`);
  const result = await contract.setAdminFeeShare(adminFeeShareBP);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
