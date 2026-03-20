import { ethers } from 'hardhat';
import { handleTransactionResult, getEnv } from '../helper';

async function main() {
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');
  const relayerAuthority ="0x0";

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const result = await contract.removeRelayerAuthority(relayerAuthority);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
