import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const newOwner = process.env.OWNER;
  if (!newOwner) {
    throw new Error('No owner address');
  }

  const contract = await ethers.getContractAt('Messenger', messengerAddress);
  const result = await contract.transferOwnership(newOwner);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
