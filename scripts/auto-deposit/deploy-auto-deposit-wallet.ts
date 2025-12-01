import { ethers } from 'hardhat';
import { addressToBytes32, getEnv, handleTransactionResult } from '../helper';

async function main() {
  const autoDepositFactoryAddress = getEnv('AUTO_DEPOSIT_FACTORY');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');
  const ownerAddress = getEnv('OWNER');

  const contract = await ethers.getContractAt('AutoDepositFactory', autoDepositFactoryAddress);

  const recipientChainId = 5;
  const recipient = addressToBytes32(ownerAddress);
  const recipientToken = addressToBytes32('0x69Cac3A30C7D45b49EeaD0C1ea7af4922D496bC6');
  const minDepositTokens = 1;
  const predictedAddress = await contract.getDepositWalletAddress(
    recipientChainId,
    bridgeAddress,
    recipient,
    recipientToken,
    minDepositTokens,
  );
  console.log('Deploy to', predictedAddress);

  const result = await contract.deployDepositWallet(
    recipientChainId,
    bridgeAddress,
    recipient,
    recipientToken,
    minDepositTokens,
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
