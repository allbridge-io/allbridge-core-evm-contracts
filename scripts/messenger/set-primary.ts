import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const contract = await ethers.getContractAt('Messenger', messengerAddress);
  const result = await contract.setPrimaryValidator(
    '0xbf115b8c76f233ad1b799aa2589213d9ce552192',
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
