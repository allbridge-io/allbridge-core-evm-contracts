import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatEther } from 'ethers/lib/utils';

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const cctpBridge = await ethers.getContractAt(
    'CctpBridge',
    cctpBridgeAddress,
  );

  const currentBalance = await ethers.provider.getBalance(cctpBridgeAddress);
  console.log(`CCTP Bridge balance is ${formatEther(currentBalance)}`);
  if (currentBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }
  console.log(
    `Withdraw from the CCTP Bridge contract ${formatEther(currentBalance)}`,
  );
  await handleTransactionResult(await cctpBridge.withdrawGas(currentBalance));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
