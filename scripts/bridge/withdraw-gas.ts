import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { formatEther } from 'ethers/lib/utils';

async function main() {
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');
  const contract = await ethers.getContractAt('Bridge', bridgeAddress);

  const currentBalance = await ethers.provider.getBalance(bridgeAddress);
  console.log(`Bridge balance is ${formatEther(currentBalance)}`);
  if (currentBalance.isZero()) {
    console.log(`Nothing to withdraw`);
    return;
  }
  console.log(
    `Withdraw from the Bridge contract ${formatEther(currentBalance)}`,
  );
  await handleTransactionResult(
    await contract.withdrawGasTokens(currentBalance),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
