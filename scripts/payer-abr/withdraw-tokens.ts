import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits } from 'ethers/lib/utils';

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const tokenAddress = getEnv('ABR_TOKEN_ADDRESS');
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const token = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    tokenAddress,
  );

  const tokenDecimals = await token.decimals();
  const tokenSymbol = await token.symbol();
  const tokensBalance = await token.balanceOf(contractAddress);
  console.log(
    `Payer token balance is ${formatUnits(
      tokensBalance,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );
  if (tokensBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }

  console.log(`Withdraw tokens from the Payer contract`);
  await handleTransactionResult(await contract.withdrawTokens(tokenAddress));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
