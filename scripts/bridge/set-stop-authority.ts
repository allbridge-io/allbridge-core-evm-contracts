import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const newStopAuthority = '0x...';

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const result = await contract.setStopAuthority(newStopAuthority);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
