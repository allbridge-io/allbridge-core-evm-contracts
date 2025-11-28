import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const MESSENGER_PROTOCOL = 1; // Allbridge
// const MESSENGER_PROTOCOL = 2; // Wormhole

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');

  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const result = await contract.registerTarget(
    MESSENGER_PROTOCOL,
    bridgeAddress,
    'swapAndBridge(bytes32,uint256,bytes32,uint256,bytes32,uint256,uint8,uint256)',
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
