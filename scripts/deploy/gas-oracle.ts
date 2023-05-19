import { ethers } from 'hardhat';
import { getRequiredEnvVariable, handleDeployResult } from '../helper';

const CHAIN_PRECISION = 18;

async function main() {
  const chainId = +getRequiredEnvVariable('CHAIN_ID');

  const Contract = await ethers.getContractFactory('GasOracle');
  const contract = await Contract.deploy(chainId, CHAIN_PRECISION);

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
