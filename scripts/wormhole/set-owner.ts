import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const wormholeMessengerAddress = process.env.WORMHOLE_MESSENGER_ADDRESS;
  if (!wormholeMessengerAddress) {
    throw new Error('No wormhole messenger address');
  }

  const newOwner = process.env.OWNER;
  if (!newOwner) {
    throw new Error('No owner address');
  }

  const contract = await ethers.getContractAt(
    'WormholeMessenger',
    wormholeMessengerAddress,
  );
  const result = await contract.transferOwnership(newOwner);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
