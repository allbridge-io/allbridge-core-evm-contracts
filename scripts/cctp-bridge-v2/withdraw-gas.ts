import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatEther } from 'ethers/lib/utils';

async function main() {
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', cctpV2BridgeAddress);

  const currentBalance = await ethers.provider.getBalance(cctpV2BridgeAddress);
  console.log(`CCTP Bridge balance is ${formatEther(currentBalance)}`);
  if (currentBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }
  console.log(`Withdraw from the CCTP Bridge contract ${formatEther(currentBalance)}`);
  await handleTransactionResult(await cctpV2Bridge.withdrawGas(currentBalance));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
