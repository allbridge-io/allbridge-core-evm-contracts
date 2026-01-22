import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';
// @ts-ignore
import { loadSolSource, assertContainsSafeERC20 } from '../utils/code-asserts';

async function main() {
  const source = loadSolSource('PayerWithAbr');
  assertContainsSafeERC20(source);

  const abrTokenAddress = getEnv('ABR_TOKEN_ADDRESS');
  const gasOracle = getEnv('GAS_ORACLE_ADDRESS');
  const chainId = getEnv('CHAIN_ID');

  const Contract = await ethers.getContractFactory('PayerWithAbr');
  const contract = await Contract.deploy(
    abrTokenAddress,
    gasOracle,
    chainId,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
