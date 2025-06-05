import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { Big } from 'big.js';

async function main() {
  const oftBridgeAddress = process.env.OFT_BRIDGE_ADDRESS;
  if (!oftBridgeAddress) {
    throw new Error('No oft bridge address');
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const contract = await ethers.getContractAt('OftBridge', oftBridgeAddress);

  const currentFeeBp = await contract.adminFeeShareBP(tokenAddress);
  const feeBP = getEnv('OFT_FEE_BP');
  console.log('Current Fee BP:', currentFeeBp.toString());
  console.log('New Fee BP:', feeBP);

  if (!Big(currentFeeBp.toString()).eq(feeBP)) {
    const result = await contract.setAdminFeeShare(tokenAddress, feeBP);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
