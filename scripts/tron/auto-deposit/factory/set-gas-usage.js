const { callContract } = require('../../helper');

(async function () {
  const autoDepositFactoryAddress = process.env.AUTO_DEPOSIT_FACTORY_ADDRESS;
  if (!autoDepositFactoryAddress) {
    throw new Error('No auto deposit factory address');
  }

  const anotherChainId = 2; //TODO replace with another chain id
  const newGasUsage = 200000; //TODO replace with another chain gas usage
  console.log(`New gas usage is ${newGasUsage} for chain id #${anotherChainId}`);

  const result = await callContract(
    'AutoDepositFactory',
    autoDepositFactoryAddress,
    'setGasUsage',
    anotherChainId,
    newGasUsage,
  );
  console.log(result);
})();
