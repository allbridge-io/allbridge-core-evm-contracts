import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';
import { loadSolSource, assertContainsSafeERC20 } from '../utils/code-asserts';

async function main() {
  const source = loadSolSource('XReserveBridge');
  assertContainsSafeERC20(source);

  const chainId = +(getEnv('CHAIN_ID'));
  const tokenAddress = getEnv('USDC_ADDRESS');
  const xReserveAddress = getEnv('X_RESERVE_ADDRESS');

  console.log('chainId', chainId);
  console.log('tokenAddress', tokenAddress);
  console.log('xReserveAddress', xReserveAddress);

  const Contract = await ethers.getContractFactory('XReserveBridge');
  const contract = await Contract.deploy(
    chainId,
    tokenAddress,
    xReserveAddress,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
