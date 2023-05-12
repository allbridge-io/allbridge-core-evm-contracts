const { getContract } = require('./helper');

(async function () {
  const address = 'TCagwZajYWSGNvLC2fZbtRQte15eJjawe5';
  const result = await getContract('Test', address, 'getBytes32');
  console.log(result);
})();
