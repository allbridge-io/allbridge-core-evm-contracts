import { ethers } from 'hardhat';
import { getEnv } from '../helper';
import { formatUnits } from 'ethers/lib/utils';

const destinationChainId = 9;

async function main() {
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', cctpV2BridgeAddress);
  const usdcAddress = getEnv('USDC_ADDRESS');
  const token = await ethers.getContractAt('Token', usdcAddress);

  const gasUsage = await cctpV2Bridge.gasUsage(destinationChainId);
  console.log('Gas usage:', gasUsage.toString());

  const txCostAmount = await cctpV2Bridge.getTransactionCost(destinationChainId);
  console.log(`Bridging cost: ${txCostAmount}`);

  const bridgingCost = await cctpV2Bridge.getBridgingCostInTokens(
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
