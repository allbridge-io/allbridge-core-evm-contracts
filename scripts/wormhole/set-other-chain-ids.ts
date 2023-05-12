import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const wormholeMessengerAddress = process.env.WORMHOLE_MESSENGER_ADDRESS;
  if (!wormholeMessengerAddress) {
    throw new Error('No messenger address');
  }

  const chainId = process.env.CHAIN_ID ? +process.env.CHAIN_ID : undefined;
  if (!chainId) {
    throw new Error('No chain id');
  }

  const contract = await ethers.getContractAt(
    'WormholeMessenger',
    wormholeMessengerAddress,
  );

  const otherChainIds = Buffer.from([
    0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);
  otherChainIds[chainId] = 0;
  const result = await contract.setOtherChainIds(otherChainIds);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
