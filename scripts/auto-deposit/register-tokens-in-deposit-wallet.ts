import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { ContractTransaction } from 'ethers';

async function main() {
  const autoDepositWalletAddress = getEnv('AUTO_DEPOSIT_WALLET');
  const contract = await ethers.getContractAt('AutoDepositWallet', autoDepositWalletAddress);
  const tokenAddresses = [
    '0x49be77224DC061BD53699B25431B9Aa7029A2cB8',
  ];

  const tokensToRegister = tokenAddresses.filter(async (token) => {
    const amount = await contract.minDepositTokenAmount(token);
    return amount.eq(0);
  });

  let result: ContractTransaction;
  if (tokensToRegister.length === 0) {
    console.log('Nothing to register');
    return;
  } else if (tokensToRegister.length === 1) {
    console.log(`Register token ${tokensToRegister[0]}`)
    result = await contract.registerToken(tokensToRegister[0]);
  } else {
    console.log(`Register tokens ${tokensToRegister.join()}`)
    result = await contract.registerTokens(tokensToRegister);
  }
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
