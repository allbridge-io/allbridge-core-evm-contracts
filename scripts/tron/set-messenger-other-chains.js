const { callContract } = require('./helper');

(async function () {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const otherChainIds = Buffer.from([
    0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);
  const result = await callContract(
    'Messenger',
    messengerAddress,
    'setOtherChainIds',
    otherChainIds,
  );
  console.log(result);
})();
