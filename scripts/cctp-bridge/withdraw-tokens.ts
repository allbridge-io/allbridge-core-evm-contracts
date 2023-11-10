import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits } from 'ethers/lib/utils';

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');
  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);
  const token = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    usdcAddress,
  );

  const tokenDecimals = await token.decimals();
  const tokenSymbol = await token.symbol();
  const tokensBalance = await token.balanceOf(cctpBridgeAddress);
  console.log(
    `CCTP Bridge token balance is ${formatUnits(
      tokensBalance,
      tokenDecimals,
    )} ${tokenSymbol}`,
  );
  if (tokensBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }

  console.log(`Withdraw tokens from the CCTP Bridge contract`);
  await handleTransactionResult(await cctpBridge.withdrawFeeInTokens());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
