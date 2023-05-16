const dotenv = require('dotenv');
const port = process.env.HOST_PORT || 9090;

const network = getNetwork();
dotenv.config({ path: network ? `.env.${network}` : '.env' });

module.exports = {
  save: false,
  networks: {
    tron: {
      // Don't put your private key here:
      privateKey: process.env.PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 1000 * 1e6,
      fullHost: 'https://api.trongrid.io',
      network_id: '1',
    },
    shasta: {
      privateKey: process.env.PRIVATE_KEY,
      userFeePercentage: 50,
      feeLimit: 1000 * 1e6,
      fullHost: process.env.NODE_URL,
      network_id: '2',
      reset: true,
      save: false,
    },
    nile: {
      privateKey: process.env.PRIVATE_KEY,
      userFeePercentage: 100,
      feeLimit: 15000 * 1e6,
      fullHost: process.env.NODE_URL,
      network_id: '3',
    },
    development: {
      // For trontools/quickstart docker image
      privateKey: 'da146374a75310b9666e834ee4ad0866d6f4035967bfc76217c5a495fff9f0d0',
      userFeePercentage: 0,
      feeLimit: 1000 * 1e6,
      fullHost: 'http://127.0.0.1:' + port,
      network_id: '9',
    },
    compilers: {
      solc: {
        version: '0.8.11',
      },
    },
  },
  // solc compiler optimize
  solc: {
    //   optimizer: {
    //     enabled: true,
    //     runs: 200
    //   },
    //   evmVersion: 'istanbul'
  },
};

function getNetwork() {
  const keyIndex = process.argv.indexOf('--network');
  if (keyIndex >= 0) {
    return process.argv[keyIndex + 1];
  }
}
