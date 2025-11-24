import { ethers } from 'hardhat';
import { getEnv } from '../helper';
import { formatUnits } from 'ethers/lib/utils';

const destinationChainId = 6;
const messenger = 1;

async function main() {
  const contractAddress = getEnv('BRIDGE_PAYER_ADDRESS');
  const abrTokenAddress = getEnv('ABR_TOKEN_ADDRESS');
  const abrToken = await ethers.getContractAt('Token', abrTokenAddress);
  const contract = await ethers.getContractAt('BridgePayerWithToken', contractAddress);

  const cost = await contract.getBridgeFeeInAbr(
    destinationChainId,
    messenger,
  );
  const decimals = await abrToken.decimals();
  const symbol = await abrToken.symbol();
  console.log(`Bridging cost: ${formatUnits(cost, decimals)} ${symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
