import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const autoDepositWalletAddress = getEnv('AUTO_DEPOSIT_WALLET');
  const token = getEnv('UNSUPPORTED_TOKEN');
  const recipient = getEnv('UNSUPPORTED_TOKEN_RECIPIENT');

  const contract = await ethers.getContractAt('AutoDepositWallet', autoDepositWalletAddress);
  const result = await contract.transferUnsupportedToken(
    token,
    recipient,
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
