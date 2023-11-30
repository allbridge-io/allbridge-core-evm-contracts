import { ethers } from 'hardhat';
import {
  handleTransactionResult,
  solanaAddressToBytes32,
  addressToBytes32,
  tronAddressToBytes32,
  getEnv,
} from '../helper';

const map = new Map<number, string>();
/* cSpell:disable */
map.set(1, addressToBytes32('0xa32196E86CaA4E5d8bB44A7e7f162804421E38B7'));
map.set(2, addressToBytes32('0xAA8d065E35929942f10fa8Cb58A9AF24eE03655D'));
map.set(3, tronAddressToBytes32('TBFrH4gFkXTiRoXdBLszXG32aks8KrUGsz'));
map.set(
  4,
  solanaAddressToBytes32('EmLt85sXNvqjzZo3C6BCq55ZzSuvSNFomVnf6b1PgY8R'),
);
map.set(5, addressToBytes32('0x763e75cA7bC589396f0e5c1B8049Ac5ED7C8387F'));
map.set(6, addressToBytes32('0xC63C0261c2F1d21b3efE7828032E646c797EE21e'));
map.set(
  7,
  '0x2ea921884154a3820a66f501f01825eab0e110ad14f88014af4ed5cd773ca2e6',
);
map.set(8, addressToBytes32('0x143c50112e866Aa06716296C7fb30924ECb5672F'));
map.set(9, addressToBytes32('0x6E7C9D9D65A5333Fde4b7cF80aA6fc2401edCB65'));
map.set(10, addressToBytes32('0x760d5D74bead2CceF05cCBfDE32a08ebE7e4cfcE'));
/* cSpell:enable */

async function main() {
  const currentChainId = getEnv('CHAIN_ID');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  for (const [chainId, address] of map) {
    if (+currentChainId === chainId) continue;
    const currentAddress = await contract.otherBridges(chainId);

    console.log(`Chain ID: ${chainId} Current address: ${currentAddress})`);
    if (currentAddress === address) continue;
    console.log(`Set new bridge address: ${address})`);
    await handleTransactionResult(
      await contract.registerBridge(chainId, address),
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
