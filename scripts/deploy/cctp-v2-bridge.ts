import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';
import { assertContainsSafeERC20, loadSolSource } from '../utils/code-asserts';

const CHAIN_PRECISION = 18;

async function main() {
  const cctpBridgeSource = loadSolSource('CctpV2Bridge');

  assertContainsSafeERC20(cctpBridgeSource);

  const chainId = +getEnv('CHAIN_ID');
  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');
  const cctpMessengerAddress = getEnv('CCTP_V2_MESSENGER_ADDRESS');
  const cctpTransmitterAddress = getEnv('CCTP_V2_TRANSMITTER_ADDRESS');

  console.log({
    chainId,
    gasOracleAddress,
    usdcAddress,
    cctpMessengerAddress,
    cctpTransmitterAddress,
  });

  const Contract = await ethers.getContractFactory('CctpV2Bridge');
  const contract = await Contract.deploy(
    chainId,
    CHAIN_PRECISION.toString(),
    usdcAddress,
    cctpMessengerAddress,
    cctpTransmitterAddress,
    gasOracleAddress,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
