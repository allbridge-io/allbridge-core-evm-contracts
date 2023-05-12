import {BaseContract, ContractTransaction} from 'ethers';
import bs58 from 'bs58';

const TronWeb = require('tronweb');

export async function handleDeployResult(contract: BaseContract) {
  console.log('Contract address: ', contract.address);
  console.log('Deploying transaction...:', contract.deployTransaction.hash);
  await contract.deployTransaction.wait();
  console.log('Done');
}

export async function handleTransactionResult(result: ContractTransaction) {
  console.log('Sending transaction...:', result.hash);
  await result.wait();
  console.log('Done');
}

export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/i, ''), 'hex');
}

export function bufferToSize(buffer: Buffer, size: number): Buffer {
  if (buffer.length >= size) {
    return buffer;
  }
  const result = Buffer.alloc(size, 0);
  buffer.copy(result, size - buffer.length);
  return result;
}

export function bufferToHex(buffer: Buffer): string {
  return '0x' + buffer.toString('hex');
}

export function normalizeHex(hex: string): string {
  return bufferToHex(hexToBuffer(hex));
}

export function addressToBytes32(address: string): string {
  const buffer = hexToBuffer(address);
  const sizedBuffer = bufferToSize(buffer, 32);
  return bufferToHex(sizedBuffer);
}

export function solanaAddressToBytes32(address: string): string {
  const buffer = Buffer.from(bs58.decode(address));
  return bufferToHex(buffer);
}

function tronAddressToEthAddress(address: string): string {
  return Buffer.from(TronWeb.utils.crypto.decodeBase58Address(address))
    .toString('hex')
    .replace(/^41/, '0x');
}

export function tronAddressToBytes32(address: string): string {
  const ethAddress = tronAddressToEthAddress(address);
  const buffer = hexToBuffer(ethAddress);
  const sizedBuffer = bufferToSize(buffer, 32);
  return bufferToHex(sizedBuffer);
}

export function getRequiredEnvVariable(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not defined`);
  }
  return value;
}
