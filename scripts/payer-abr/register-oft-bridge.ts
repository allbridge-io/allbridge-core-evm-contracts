import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const MESSENGER_PROTOCOL = 5; // OFT

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const bridgeAddress = getEnv('OFT_BRIDGE_ADDRESS');

  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  const result = await contract.registerTarget(
    MESSENGER_PROTOCOL,
    bridgeAddress,
    'bridge(address,uint256,bytes32,uint256,uint256,uint256,uint256)',
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
