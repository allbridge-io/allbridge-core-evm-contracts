import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';
import { parseEther } from 'ethers/lib/utils';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const result = await contract.withdrawGasTokens(parseEther('1.5'));
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
