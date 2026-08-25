import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const tokenAddress = getEnv('USDC_ADDRESS');
  const bridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');

  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const result = await contract.approveBridgeToken(
    tokenAddress,
    bridgeAddress,
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
