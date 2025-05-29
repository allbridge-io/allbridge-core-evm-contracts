import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';
const CHAIN_PRECISION = 18;

async function main() {

  const chainId = +getEnv('CHAIN_ID');
  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');

  const Contract = await ethers.getContractFactory('OftBridge');
  const contract = await Contract.deploy(
    chainId,
    CHAIN_PRECISION.toString(),
    gasOracleAddress,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
