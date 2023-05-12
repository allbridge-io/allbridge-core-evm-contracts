import { ethers } from 'hardhat';
import { handleDeployResult } from '../helper';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const lpTokenName = process.env.LP_TOKEN_NAME;
  const lpTokenSymbol = process.env.LP_TOKEN_SYMBOL;
  if (!lpTokenName || !lpTokenSymbol) {
    throw new Error('No LP token name or symbol');
  }

  const Contract = await ethers.getContractFactory('Pool');
  const contract = await Contract.deploy(
    bridgeAddress,
    20,
    tokenAddress,
    30,
    500,
    lpTokenName,
    lpTokenSymbol,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
