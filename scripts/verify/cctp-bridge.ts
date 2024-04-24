import hre from 'hardhat';
import { getEnv } from '../helper';
const CHAIN_PRECISION = 18;

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');

  const chainId = +getEnv('CHAIN_ID');
  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');
  const cctpMessengerAddress = getEnv('CCTP_MESSENGER_ADDRESS');
  const cctpTransmitterAddress = getEnv('CCTP_TRANSMITTER_ADDRESS');

  await hre.run('verify:verify', {
    address: cctpBridgeAddress,
    constructorArguments: [
      chainId,
      CHAIN_PRECISION.toString(),
      usdcAddress,
      cctpMessengerAddress,
      cctpTransmitterAddress,
      gasOracleAddress,
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
