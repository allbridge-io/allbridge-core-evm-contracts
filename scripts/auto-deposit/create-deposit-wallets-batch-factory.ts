import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const autoDepositFactoryAddress = getEnv('AUTO_DEPOSIT_FACTORY');
  const contract = await ethers.getContractAt(
    'AutoDepositFactory',
    autoDepositFactoryAddress,
  );

  const tokenAddress = getEnv('TOKEN_ADDRESS');
  const token = await ethers.getContractAt('Token', tokenAddress);

  const myAddress = '0xb3A88d47eEda762610C4D86Ea6c8562288d53dfA'; //TODO replace with your address
  const minDepositAmount = 10; // TODO replace with your min deposit amount
  const anotherChainId = 11; //TODO replace with another chain id
  const anotherChainIds = [anotherChainId];

  const signer = (await ethers.getSigners())[0];

  console.log('Signer address: ', signer.address);

  if (
    (await token.allowance(signer.address, autoDepositFactoryAddress)).isZero()
  ) {
    console.log('Approve bridge contract');
    await handleTransactionResult(
      await token.approve(
        autoDepositFactoryAddress,
        ethers.constants.MaxUint256,
      ),
    );
  }

  const transactionCost = await contract.getTransactionCost(anotherChainId);
  console.log(`Current transactionCost is ${transactionCost}`);

  const result = await contract.createDepositWalletsBatch(
    myAddress,
    tokenAddress,
    minDepositAmount,
    transactionCost,
    anotherChainIds,
    { value: transactionCost },
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
