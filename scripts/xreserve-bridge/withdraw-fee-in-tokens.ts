import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const xReserveBridgeAddress = getEnv('X_RESERVE_BRIDGE_ADDRESS');

  const contract = await ethers.getContractAt('XReserveBridge', xReserveBridgeAddress);
  console.log('Withdrawing fee in tokens');
  const result = await contract.withdrawFeeInTokens();
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
