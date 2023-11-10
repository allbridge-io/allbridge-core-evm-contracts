import { ethers } from 'hardhat';
import { addressToBytes32, handleTransactionResult, solanaAddressToBytes32 } from '../helper';

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
      1, // wormhole chain id from https://book.wormhole.com/reference/contracts.html
      // addressToBytes32(
      //   '0xc78642d8e80f0ee195600599cb5498dc53049202a18cc07aac90b68b72dd9943', // deployed wormhole address
      // ),
      solanaAddressToBytes32('3dPvx6iKLAqLfeisJdeyzrVSaN6BDSHMYuCSdbm2TUPZ') // bridge authority address
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
