import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

// solana = 0.000005 fee + 0.00322748 accounts receive + 0.000015 pre fee + 0.00119124 pre account = 0.00443872 ≈ 4500K lamports (1000 lamport)

async function main() {
  const wormholeMessengerAddress = process.env.WORMHOLE_MESSENGER_ADDRESS;
  if (!wormholeMessengerAddress) {
    throw new Error('No messenger address');
  }

  const contract = await ethers.getContractAt(
    'WormholeMessenger',
    wormholeMessengerAddress,
  );
  const result = await contract.setGasUsage(5, 4500);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
