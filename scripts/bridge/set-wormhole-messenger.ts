import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }
  const wormholeMessengerAddress = process.env.WORMHOLE_MESSENGER_ADDRESS;
  if (!wormholeMessengerAddress) {
    throw new Error('No wormhole messenger address');
  }

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const result = await contract.setWormholeMessenger(wormholeMessengerAddress);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
