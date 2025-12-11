import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits, parseUnits } from 'ethers/lib/utils';

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const exchangeRatePrecision = Number(await contract.EXCHANGE_RATE_PRECISION());

  const rateDecimal = getEnv('ABR_PRICE'); // ABR/USD
  const currentExchangeRate = await contract.exchangeRate();
  console.log('Current rate:', formatUnits(currentExchangeRate.toString(), exchangeRatePrecision));
  console.log('New rate:', rateDecimal);

  const result = await contract.setExchangeRate(parseUnits(rateDecimal, exchangeRatePrecision));
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
