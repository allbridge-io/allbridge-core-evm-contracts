import { ethers } from 'hardhat';
import { addressToBytes32, handleTransactionResult } from '../helper';

async function main() {
  const wormholeMessengerAddress = process.env.WORMHOLE_MESSENGER_ADDRESS;
  if (!wormholeMessengerAddress) {
    throw new Error('No wormhole messenger address');
  }

  const contract = await ethers.getContractAt(
    'WormholeMessenger',
    wormholeMessengerAddress,
  );

  await handleTransactionResult(
    await contract.registerWormholeMessenger(
      1,
      addressToBytes32(
        '0xc78642d8e80f0ee195600599cb5498dc53049202a18cc07aac90b68b72dd9943',
      ),
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
