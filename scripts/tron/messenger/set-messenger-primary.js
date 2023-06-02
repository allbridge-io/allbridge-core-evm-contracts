const { callContract } = require('../helper');

(async function () {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const result = await callContract(
    'Messenger',
    messengerAddress,
    'setPrimaryValidator',
    'TBZr98rWopU8gyk2DmnozFd7atNzDfgVqa',
  );
  console.log(result);
})();
