import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';
// @ts-ignore
import { loadSolSource, assertContainsSafeERC20 } from '../utils/code-asserts';

const CHAIN_PRECISION = 18;

async function main() {
  const source = loadSolSource('AutoDepositFactory');
  assertContainsSafeERC20(source);

  const chainId = +getEnv('CHAIN_ID');
  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');

  const Contract = await ethers.getContractFactory('AutoDepositFactory');
  const contract = await Contract.deploy(
    chainId,
    CHAIN_PRECISION,
    gasOracleAddress,
    0xff // 0xff for EVM, 0x41 for Tron
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
