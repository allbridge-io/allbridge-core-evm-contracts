import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const newAddress = getEnv('ABR_PAYER_PRICE_AUTHORITY_ADDRESS');
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const result = await contract.setPriceAuthority(newAddress);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
