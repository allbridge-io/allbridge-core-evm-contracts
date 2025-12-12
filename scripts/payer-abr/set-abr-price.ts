import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits, parseUnits } from 'ethers/lib/utils';

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const abrPricePrecision = Number(await contract.PRICE_PRECISION());

  const priceFloat = getEnv('ABR_PRICE'); // ABR/USD
  const currentAbrPrice = await contract.price();
  const currentPriceFloat = formatUnits(currentAbrPrice.toString(), abrPricePrecision);
  console.log(`Current price: ${currentPriceFloat} USD`);
  console.log(`New price: ${priceFloat} USD`);

  const result = await contract.setPrice(parseUnits(priceFloat, abrPricePrecision));
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
