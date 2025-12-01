const { callContract, getContract } = require('../../helper');
const { parseUnits, formatUnits } = require('ethers/lib/utils');

(async function () {
  const autoDepositFactoryAddress = process.env.AUTO_DEPOSIT_FACTORY_ADDRESS;
  if (!autoDepositFactoryAddress) {
    throw new Error('No auto deposit factory address');
  }

  const currentCost = await getContract("AutoDepositFactory", autoDepositFactoryAddress, "sendTxCost");
  console.log(`Current send tx cost is ${formatUnits(currentCost, 6)}`);

  const newCost = parseUnits('0.0002', 6); //TODO replace with another chain gas price
  console.log(`New send tx cost is     ${formatUnits(newCost, 6)}`);

  if (newCost.eq(currentCost)) {
    console.log('Nothing to update');
    return;
  }

  const result = await callContract(
    'AutoDepositFactory',
    autoDepositFactoryAddress,
    'setSendTxCost',
    newCost,
  );
  console.log(result);
})();
