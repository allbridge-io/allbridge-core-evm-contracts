import { ethers } from 'hardhat';
import { getRequiredEnvVariable, handleDeployResult } from '../helper';

async function main() {
  const chainId = +(getRequiredEnvVariable('CHAIN_ID'));

  const gasOracleAddress = getRequiredEnvVariable('GAS_ORACLE_ADDRESS');
  const primaryValidator = getRequiredEnvVariable('PRIMARY_VALIDATOR_ADDRESS')

  const secondaryValidators = JSON.parse(getRequiredEnvVariable('SECONDARY_VALIDATOR_ADDRESSES'));

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
    primaryValidator,
    secondaryValidators,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
