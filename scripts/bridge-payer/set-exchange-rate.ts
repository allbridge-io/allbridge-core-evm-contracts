import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { parseUnits } from 'ethers/lib/utils';

const EXCHANGE_RATE_PRECISION = 18;

async function main() {
  const contractAddress = getEnv('BRIDGE_PAYER_ADDRESS');
  const contract = await ethers.getContractAt('BridgePayerWithToken', contractAddress);
  const rateDecimal = '0.0'; // ABR/ETH
  const result = await contract.setExchangeRate(parseUnits(rateDecimal, EXCHANGE_RATE_PRECISION));
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
