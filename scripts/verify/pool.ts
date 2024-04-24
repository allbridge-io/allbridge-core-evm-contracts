import hre from 'hardhat';

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

  const poolAddress = process.env.POOL_ADDRESS;
  await hre.run('verify:verify', {
    address: poolAddress,
    constructorArguments: [
      bridgeAddress,
      20,
      tokenAddress,
      30,
      500,
      lpTokenName,
      lpTokenSymbol,
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
