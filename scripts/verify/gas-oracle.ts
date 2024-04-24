import hre from 'hardhat';
import { getEnv } from '../helper';

const CHAIN_PRECISION = 18;

async function main() {
  const chainId = +getEnv('CHAIN_ID');
  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');

  await hre.run('verify:verify', {
    address: gasOracleAddress,
    constructorArguments: [chainId, CHAIN_PRECISION],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
