const { ethers } = require('ethers');
const { callContract, callContractWithParams, getContract, getSignerAddress } = require('../../helper');

(async function () {
  const autoDepositFactoryAddress = process.env.AUTO_DEPOSIT_FACTORY_ADDRESS;
  if (!autoDepositFactoryAddress) {
    throw new Error('No auto deposit factory address');
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const myAddress = 'TVRatq56xSxNjYvgqTXjsFHg9AYWTUjiAx'; //TODO replace with your address
  const anotherChainId = 2; //TODO replace with another chain id
  const minDepositAmount = 10; // TODO replace with your min deposit amount
  const anotherChainIds = [anotherChainId];

  const signer = getSignerAddress();
  console.log('Signer address:', signer);

  const allowance = await getContract('ERC20', tokenAddress, 'allowance', signer, autoDepositFactoryAddress);
  if (allowance.toNumber() === 0) {
    console.log('Approve auto deposit factory contract');
    await callContract(
      "ERC20",
      tokenAddress,
      "approve",
      autoDepositFactoryAddress,
      ethers.constants.MaxUint256,
    )
  }

  const transactionCost = await getContract('AutoDepositFactory', autoDepositFactoryAddress, 'getTransactionCost', anotherChainId);
  console.log(`Current transactionCost is ${transactionCost}`);

  const result = await callContractWithParams(
    'AutoDepositFactory',
    autoDepositFactoryAddress,
    'createDepositWalletsBatch',
    {
      callValue: Number(transactionCost),
    },
    myAddress,
    tokenAddress,
    minDepositAmount,
    transactionCost,
    anotherChainIds,
  );
  console.log(result);
})();
