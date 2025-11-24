import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';
// @ts-ignore
import { loadSolSource, assertContainsSafeERC20 } from '../utils/code-asserts';

const CHAIN_PRECISION = 18;

async function main() {
  const source = loadSolSource('BridgePayerWithToken');
  assertContainsSafeERC20(source);

  const abrTokenAddress = getEnv('ABR_TOKEN_ADDRESS');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');

  const Contract = await ethers.getContractFactory('BridgePayerWithToken');
  const contract = await Contract.deploy(
    abrTokenAddress,
    CHAIN_PRECISION,
    bridgeAddress,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
