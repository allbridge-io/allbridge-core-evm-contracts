import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const xReserveBridgeAddress = getEnv('X_RESERVE_BRIDGE_ADDRESS');
  const maxFeeShare = process.env.MAX_FEE_SHARE || '0';

  const contract = await ethers.getContractAt('XReserveBridge', xReserveBridgeAddress);
  console.log(`Setting max fee share: ${maxFeeShare}`);
  const result = await contract.setMaxFeeShare(maxFeeShare);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
