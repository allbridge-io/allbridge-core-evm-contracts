import { ethers } from 'hardhat';
import { getEnv } from '../helper';
import { formatUnits } from 'ethers/lib/utils';

const destinationChainId = 6;

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);
  const usdcAddress = getEnv('USDC_ADDRESS');
  const token = await ethers.getContractAt('Token', usdcAddress);

  const gasUsage = await cctpBridge.gasUsage(destinationChainId);
  console.log('Gas usage:', gasUsage.toString());

  const txCostAmount = await cctpBridge.getTransactionCost(destinationChainId);
  console.log(`Bridging cost: ${txCostAmount}`);

  const bridgingCost = await cctpBridge.getBridgingCostInTokens(
    destinationChainId,
  );
  const decimals = await token.decimals();
  const symbol = await token.symbol();
  console.log(`Bridging cost: ${formatUnits(bridgingCost, decimals)} ${symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
