const {
  callContract,
  ethAddressToBytes32,
  solanaAddressToBytes32,
} = require('./helper');

(async function () {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const result = await callContract(
    'Bridge',
    bridgeAddress,
    'addBridgeToken',
    5,
    // ethAddressToBytes32('0x54B79d73d514224379107703C6102D53E321aEFa'),
    solanaAddressToBytes32('FpGHqNpwDctcaJyu24M9E2ydTe5owPQgD7UdarKEJHd4'),
  );
  console.log(result);
})();
