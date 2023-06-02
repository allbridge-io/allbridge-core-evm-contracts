const { callContract } = require('../helper');

(async function () {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const result = await callContract(
    'Messenger',
    messengerAddress,
    'setSecondaryValidators',
    ['TSWtX2HWgvrGZTTsv9CukCFvDagP4U1H6D'],
    ['TBZr98rWopU8gyk2DmnozFd7atNzDfgVqa'],
  );
  console.log(result);
})();
