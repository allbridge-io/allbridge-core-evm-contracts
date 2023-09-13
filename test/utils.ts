import { Big, BigSource } from 'big.js';
import { BigNumber } from 'ethers';

export const SP = 3; // System precision (digits)
export const ESP = 1e3; // System precision (exponent)
export const EPP = 1e4; // Price precision (exponent)

export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex.replace(/^0x/i, ''), 'hex');
}

export function addressToBase32(address: string): string {
  const result = Buffer.alloc(32, 0);
  hexToBuffer(address).copy(result, 12);
  return '0x' + result.toString('hex');
}

export async function signMessage(
  validatorPK: string,
  message: string,
): Promise<string> {
  // eslint-disable-next-line node/no-missing-require
  const hash = require('eth-lib/lib/hash').keccak256(message);
  // eslint-disable-next-line node/no-missing-require
  return require('eth-lib/lib/account').sign(hash, validatorPK);
}

export function getSignatureR(signature: string): string {
  return '0x' + signature.slice(2, 2 + 64);
}

export function getSignatureS(signature: string): string {
  return '0x' + signature.slice(2 + 64, 2 + 128);
}

export function getSignaturesV(primary: string, secondary: string): string {
  return '0x' + primary.slice(2 + 128) + secondary.slice(2 + 128);
}

export function receiveParams(
  primary: string,
  secondary: string,
): [string, string, string, string, string] {
  return [
    getSignaturesV(primary, secondary),
    getSignatureR(primary),
    getSignatureS(primary),
    getSignatureR(secondary),
    getSignatureS(secondary),
  ];
}

export const encodeMessage = ({
  sourceChainId = 0,
  destinationChainId = 0,
  message = '',
}): string => {
  const messageBuffer = Buffer.from(message);
  const zeroedBuffer = new Array(30 - messageBuffer.length).fill(0);

  const buffer = Buffer.from([
    sourceChainId.toString(),
    destinationChainId.toString(),
    ...messageBuffer,
    ...zeroedBuffer,
  ]);
  const bufferHex = buffer.toString('hex');

  if (buffer.length > 32) {
    throw new Error(`Message too long (${buffer.length}): [${[...buffer]}]`);
  }

  return `0x${bufferHex}`;
};

export const cbrt = (n: BigNumber): BigNumber => {
  let x = BigNumber.from(0);

  for (let y = BigNumber.from(1).shl(255); y.gt(0); y = y.shr(3)) {
    x = x.shl(1);

    const z = x.add(1).mul(3).mul(x).add(1);

    if (n.div(y).gte(z)) {
      n = n.sub(y.mul(z));
      x = x.add(1);
    }
  }

  return x;
};

export const calcD = (x: BigNumber, y: BigNumber, a: BigNumber) => {
  const xy = x.mul(y);
  const p1 = a.mul(xy).mul(x.add(y));
  const p2 = xy.mul(a.shl(2).sub(1)).div(3);

  const p3Big = Big(p1.pow(2).add(p2.pow(3)).toString()).sqrt();
  const p3 = BigNumber.from(p3Big.toFixed(0));

  let d_ = cbrt(p1.add(p3));

  if (p3.gt(p1)) {
    d_ = d_.sub(cbrt(p3.sub(p1)));
  } else {
    d_ = d_.add(cbrt(p1.sub(p3)));
  }

  return d_.shl(1);
};

export function fromSystemPrecision(amount: BigSource) {
  return Big(amount).div(ESP);
}
