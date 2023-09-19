import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';

const CHAIN_PRECISION = 18;

async function main() {
  const chainId = +getEnv('CHAIN_ID');

  const Contract = await ethers.getContractFactory('GasOracle');
  const contract = await Contract.deploy(chainId, CHAIN_PRECISION);

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
