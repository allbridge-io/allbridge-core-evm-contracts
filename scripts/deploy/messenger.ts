import { ethers } from 'hardhat';
import { handleDeployResult } from '../helper';

async function main() {
  const chainId = process.env.CHAIN_ID ? +process.env.CHAIN_ID : undefined;
  if (!chainId) {
    throw new Error('No chain id');
  }

  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address');
  }

  const validator = process.env.VALIDATOR_ADDRESS;
  if (!validator) {
    throw new Error('No validator');
  }

  const otherChainIds = Buffer.from([
    0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);
  otherChainIds[chainId] = 0;

  const Contract = await ethers.getContractFactory('Messenger');
  const contract = await Contract.deploy(
    chainId,
    otherChainIds,
    gasOracleAddress,
    validator,
    [validator],
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
