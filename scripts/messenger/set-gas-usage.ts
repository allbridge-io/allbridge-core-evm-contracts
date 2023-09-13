import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

// solana = 0.000015 fee + 0.00123996 account = 0.00125496 ≈ 1300K lamports (1000 lamport)

async function main() {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const contract = await ethers.getContractAt('Messenger', messengerAddress);
  const result = await contract.setGasUsage(5, 1300);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
