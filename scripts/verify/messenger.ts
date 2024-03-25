import hre  from 'hardhat';
import { getEnv } from '../helper';

async function main() {
  const chainId = +(getEnv('CHAIN_ID'));

  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');
  const primaryValidator = getEnv('PRIMARY_VALIDATOR_ADDRESS')

  const secondaryValidators = JSON.parse(getEnv('SECONDARY_VALIDATOR_ADDRESSES'));

  const otherChainIds = Buffer.from([
    0, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);
  otherChainIds[chainId] = 0;
  const messengerAddress = process.env.MESSENGER_ADDRESS;

  await hre.run("verify:verify", {
    address: messengerAddress,
    constructorArguments: [
      chainId,
      otherChainIds,
      gasOracleAddress,
      primaryValidator,
      secondaryValidators,
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
