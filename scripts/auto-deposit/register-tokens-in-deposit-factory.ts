import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';
import { ContractTransaction } from 'ethers';

const SPL_TOKEN = [
  '0x49be77224DC061BD53699B25431B9Aa7029A2cB8',
  '0x0209dA4a278956Ca15438af8B108bd85642F096c',
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
];
const ARB_TOKEN = [
  '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
  '0xf69f1d7b9CB521EF5F855f94787a2475FB035bc7',
  '0xce37222457A727C2707c06472F6fb17C3c3C2399',
];
const BASE_TOKEN = [
  '0x97034742DF00C506Bd8b9F90e51330bf91ea59b4',
  '0xac7d9D0cc7da68F704A229a7258DC2ba654fFcBC',
];
async function main() {
  const autoDepositFactoryAddress = getEnv('AUTO_DEPOSIT_FACTORY');
  const contract = await ethers.getContractAt(
    'AutoDepositParent',
    autoDepositFactoryAddress,
  );

  const tokenAddresses = BASE_TOKEN; //TODO replace with another chain tokens
  const tokensToRegister = tokenAddresses.filter(async (token) => {
    const isAccepted = await contract.acceptedTokens(token);
    return !isAccepted;
  });

  let result: ContractTransaction;
  if (tokensToRegister.length === 0) {
    console.log('Nothing to register');
    return;
  }
  for (const tokenAddress of tokensToRegister) {
    console.log(`Register token ${tokenAddress}`);
    result = await contract.registerToken(tokenAddress);
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
