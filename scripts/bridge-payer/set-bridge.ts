import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const contractAddress = getEnv('BRIDGE_PAYER_ADDRESS');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');

  const contract = await ethers.getContractAt('BridgePayerWithToken', contractAddress);
  const result = await contract.setBridge(bridgeAddress);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
