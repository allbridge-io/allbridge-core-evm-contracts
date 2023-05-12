import { ethers } from 'hardhat';
import { getRequiredEnvVariable } from '../helper';
import { Big } from 'big.js';

async function main() {
  const bridgeAddress = getRequiredEnvVariable('BRIDGE_ADDRESS');
  const bridge = await ethers.getContractAt('Bridge', bridgeAddress);
  const tokenAddress = getRequiredEnvVariable('TOKEN_ADDRESS');
  const token = await ethers.getContractAt('Token', tokenAddress);

  const destinationChainId = 4;
  const messengerProtocol = 1;
  const bridgingCost = await bridge.getBridgingCostInTokens(
    destinationChainId,
    messengerProtocol,
    tokenAddress
  );
  const decimals = await token.decimals();
  const symbol = await token.symbol();
  const bridgingCostInUsd = Big(bridgingCost.toString()).div(Big(10).pow(decimals));
  console.log(`bridgingCost = ${bridgingCostInUsd} ${symbol}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
