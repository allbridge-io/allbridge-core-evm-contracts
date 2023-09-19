import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits } from 'ethers/lib/utils';

async function main() {
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');
  const tokenAddress = getEnv('TOKEN_ADDRESS');
  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const token = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    tokenAddress,
  );

  const tokenDecimals = await token.decimals();
  const tokenSymbol = await token.symbol();
  const tokensBalance = await token.balanceOf(bridgeAddress);
  console.log(
    `Bridge token balance is ${formatUnits(
      tokensBalance,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );
  if (tokensBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }

  console.log(`Withdraw tokens from the Bridge contract`);
  await handleTransactionResult(await contract.withdrawBridgingFeeInTokens(tokenAddress));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
