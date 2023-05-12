import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const contract = await ethers.getContractAt('Messenger', messengerAddress);
  const otherChainIds = Buffer.from([
    0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);
  const result = await contract.setOtherChainIds(otherChainIds);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
