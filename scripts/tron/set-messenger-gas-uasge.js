const { callContract } = require('./helper');

(async function () {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const result = await callContract(
    'Messenger',
    messengerAddress,
    'setGasUsage',
    5,
    1300,
  );
  console.log(result);
})();
