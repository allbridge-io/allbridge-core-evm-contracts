import { ethers } from 'hardhat';

import { encodeMessage } from '../../test/utils';
import crypto from 'crypto';

async function main() {
  console.log('connecting...');

  const contract = await ethers.getContractAt(
    'WormholeMessenger',
    '0xF8A68bbaa85ea7a6403C106B612Fcf3e83286cDD',
  );

  console.log('connected');

  const message = Buffer.from(crypto.randomBytes(12)).toString('hex');

  const encodedeMessage = encodeMessage({
    sourceChainId: 1,
    destinationChainId: 2,
    message,
  });

  console.log('message:', encodedeMessage);

  const sendTx = await contract.sendMessage(encodedeMessage);
  const receipt = await sendTx.wait();

  console.log('hash:', receipt.transactionHash);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
