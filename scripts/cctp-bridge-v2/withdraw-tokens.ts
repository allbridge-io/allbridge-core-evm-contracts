import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatUnits } from 'ethers/lib/utils';

async function main() {
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', cctpV2BridgeAddress);
  const token = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    usdcAddress,
  );

  const tokenDecimals = await token.decimals();
  const tokenSymbol = await token.symbol();
  const tokensBalance = await token.balanceOf(cctpV2BridgeAddress);
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
  await handleTransactionResult(await cctpV2Bridge.withdrawFeeInTokens());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
