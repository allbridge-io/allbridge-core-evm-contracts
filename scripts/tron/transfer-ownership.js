const { callContract, tronAddressToBuffer32 } = require('./helper');

(async function () {

  const result = await callContract(
    'GasOracle',
    'TJ1LpdGBwB2zprvz5hChHFzo5t2XJDvXT3',
    'transferOwnership',
    'TR8bmVtSkTpBHUx9GSyjAueU5AVMEoJber',
  );
  console.log(result);
})();
