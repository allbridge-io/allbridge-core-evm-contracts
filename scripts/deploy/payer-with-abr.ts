import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';
// @ts-ignore
import { loadSolSource, assertContainsSafeERC20 } from '../utils/code-asserts';

const CHAIN_PRECISION = 18;

async function main() {
  const source = loadSolSource('PayerWithAbr');
  assertContainsSafeERC20(source);

  const abrTokenAddress = getEnv('ABR_TOKEN_ADDRESS');

  const Contract = await ethers.getContractFactory('PayerWithAbr');
  const contract = await Contract.deploy(
    abrTokenAddress,
    CHAIN_PRECISION,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
