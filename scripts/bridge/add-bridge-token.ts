import { ethers } from 'hardhat';
import {
  handleTransactionResult,
  addressToBytes32,
  solanaAddressToBytes32,
  tronAddressToBytes32,
  getEnv,
} from '../helper';

const map = new Map<number, string[]>();
/* cSpell:disable */
map.set(1, [
  addressToBytes32('0xDdaC3cb57DEa3fBEFF4997d78215535Eb5787117'),
  addressToBytes32('0xC7DBC4A896b34B7a10ddA2ef72052145A9122F43'),
  addressToBytes32('0x07865c6E87B9F70255377e024ace6630C1Eaa37F'),
]);
map.set(2, [
  addressToBytes32('0x49be77224DC061BD53699B25431B9Aa7029A2cB8'),
  addressToBytes32('0x0209dA4a278956Ca15438af8B108bd85642F096c'),
  addressToBytes32('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238'),
]);
map.set(3, [
  tronAddressToBytes32('TEYM56Hk4554u8ge4vNLZcE59pv7GQy1tv'),
  tronAddressToBytes32('TEwnUeq4d2oZRtg9x7ZdZgqJhMpYzpAtLp'),
]);
map.set(4, [
  solanaAddressToBytes32('f4yhod6Y7jzVwFfy3iHDg49GAerFTrtp1Ac1ubdWx7L'),
  solanaAddressToBytes32('FpGHqNpwDctcaJyu24M9E2ydTe5owPQgD7UdarKEJHd4'),
  solanaAddressToBytes32('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU'),
]);
map.set(5, [
  addressToBytes32('0x3DBe838b635C54502C318f752187A8d8E7C73743'),
  addressToBytes32('0xd18967827F4cC29193A7dbe2AA5aD440F6b27597'),
]);
map.set(6, [addressToBytes32('0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d')]);
map.set(7, [
  '0x91c204aa743184184d9cee9da175d703f6a0e42fb8c6ed9eedf6274194160257',
  '0xc16cc69b695553803c97173165a0ef60bc3e3f30b624098906caf278bd6ff69c',
]);
map.set(8, []);
map.set(9, [addressToBytes32('0xf175520c52418dfe19c8098071a252da48cd1c19')]);
map.set(10, [
  addressToBytes32('0x97034742DF00C506Bd8b9F90e51330bf91ea59b4'),
  addressToBytes32('0xac7d9D0cc7da68F704A229a7258DC2ba654fFcBC'),
]);
/* cSpell:enable */

async function main() {
  const currentChainId = getEnv('CHAIN_ID');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);

  for (const [chainId, tokenAddresses] of map) {
    if (+currentChainId === chainId) continue;
    console.log(`Chain ID: ${chainId}`);
    for (const tokenAddress of tokenAddresses) {
      const isEnabled = await contract.otherBridgeTokens(chainId, tokenAddress);
      if (isEnabled) {
        console.log(`Token ${tokenAddress} is already enabled`);
        continue;
      }

      console.log(`Add token ${tokenAddress}`);
      await handleTransactionResult(
        await contract.addBridgeToken(chainId, tokenAddress),
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
