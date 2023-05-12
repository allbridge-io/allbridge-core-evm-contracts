const bs58 = require('bs58');

const TronWeb = require('tronweb');
const dotenv = require('dotenv');
const network = getNetwork();
const fs = require('fs');
const path = require('path');

dotenv.config({
  path: path.join(__dirname, '../../', network ? `.env.${network}` : '.env'),
});

function hexToBuffer(hex) {
  return Buffer.from(hex.replace(/^0x/i, ''), 'hex');
}

function getNetwork() {
  const keyIndex = process.argv.indexOf('--network');
  if (keyIndex >= 0) {
    return process.argv[keyIndex + 1];
  }
}

function bufferToSize(buffer, size) {
  if (buffer.length >= size) {
    return buffer;
  }
  const result = Buffer.alloc(size, 0);
  buffer.copy(result, size - buffer.length);
  return result;
}

function tronAddressToEthAddress(address) {
  return Buffer.from(TronWeb.utils.crypto.decodeBase58Address(address))
    .toString('hex')
    .replace(/^41/, '0x');
}

function ethAddressToBytes32(address) {
  const buffer = hexToBuffer(address);
  return bufferToSize(buffer, 32);
}

function tronAddressToBuffer32(address) {
  const ethAddress = tronAddressToEthAddress(address);
  const buffer = hexToBuffer(ethAddress);
  return bufferToSize(buffer, 32);
}

function solanaAddressToBytes32(address) {
  const buffer = Buffer.from(bs58.decode(address));
  return bufferToHex(buffer);
}

function bufferToHex(buffer) {
  return '0x' + buffer.toString('hex');
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(), ms));
}

async function confirmTransaction(tronWeb, txId) {
  const start = Date.now();
  while (true) {
    if (Date.now() - start > 20000) {
      throw new Error('Transaction not found');
    }
    const result = await tronWeb.trx.getUnconfirmedTransactionInfo(txId);
    if (!result.receipt) {
      await sleep(2000);
      continue;
    }
    if (result.receipt.result === 'SUCCESS') {
      return txId;
    } else {
      throw new Error(`Transaction status is ${result.receipt.result}`);
    }
  }
}

function getSignerAddress() {
  return TronWeb.address.fromPrivateKey(process.env.PRIVATE_KEY);
}

module.exports = {
  callContract: async (contractName, contractAddress, method, ...args) => {
    const { abi } = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `../../build/contracts/${contractName}.json`),
        { encoding: 'utf8' },
      ),
    );
    const node = process.env.NODE_URL;
    const privateKey = process.env.PRIVATE_KEY;
    const tronWeb = new TronWeb(node, node, node, privateKey);
    const contract = await tronWeb.contract(abi, contractAddress);
    const txId = await contract[method](...args).send();
    return await confirmTransaction(tronWeb, txId);
  },
  getContract: async (contractName, contractAddress, method, ...args) => {
    const { abi } = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, `../../build/contracts/${contractName}.json`),
        { encoding: 'utf8' },
      ),
    );
    const node = process.env.NODE_URL;
    const privateKey = process.env.PRIVATE_KEY;
    const tronWeb = new TronWeb(node, node, node, privateKey);
    const contract = await tronWeb.contract(abi, contractAddress);
    return await contract[method](...args).call();
  },
  tronAddressToBuffer32,
  ethAddressToBytes32,
  solanaAddressToBytes32,
  getSignerAddress,
};
