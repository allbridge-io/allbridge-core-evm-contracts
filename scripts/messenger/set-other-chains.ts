import { ethers } from 'hardhat';
import {
  bufferToHex,
  getEnv,
  handleTransactionResult,
  hexToBuffer,
} from '../helper';

const validDestinationChainIds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

async function main() {
  const currentChainId = getEnv('CHAIN_ID');
  const messengerAddress = getEnv('MESSENGER_ADDRESS');

  const contract = await ethers.getContractAt('Messenger', messengerAddress);
  const currentOtherChainIds = await contract.otherChainIds();
  console.log('Current otherChainIds', currentOtherChainIds);

  const otherChainIds = hexToBuffer(currentOtherChainIds).fill(0);
  for (const chainId of validDestinationChainIds) {
    if (+currentChainId === chainId) {
      otherChainIds[chainId] = 0;
    } else {
      otherChainIds[chainId] = 1;
    }
  }
  console.log('Set otherChainIds', '   ', bufferToHex(otherChainIds));

  const result = await contract.setOtherChainIds(Buffer.from(otherChainIds));
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
