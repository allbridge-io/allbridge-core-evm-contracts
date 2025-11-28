import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits, parseUnits } from 'ethers/lib/utils';

const EXCHANGE_RATE_PRECISION = 18;

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);

  const rateDecimal = getEnv('ABR_EXCHANGE_RATE'); // ABR/ETH
  const currentExchangeRate = await contract.exchangeRate();
  console.log('Current rate:', formatUnits(currentExchangeRate.toString(), EXCHANGE_RATE_PRECISION));
  console.log('New rate:', rateDecimal);

  const result = await contract.setExchangeRate(parseUnits(rateDecimal, EXCHANGE_RATE_PRECISION));
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
