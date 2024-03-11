import { ethers } from 'hardhat';
import { addressToBytes32, getEnv, handleTransactionResult } from '../helper';

async function main() {
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');
  const poolAddress = getEnv('POOL_ADDRESS');
  const tokenAddress = getEnv('TOKEN_ADDRESS');

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const result = await contract.addPool(
    poolAddress,
    addressToBytes32(tokenAddress),
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
