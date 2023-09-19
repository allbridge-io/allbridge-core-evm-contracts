import { ethers } from 'hardhat';
import { getEnv, handleDeployResult } from '../helper';
import { loadSolSource, assertContainsSafeERC20 } from '../utils/code-asserts';

const CHAIN_PRECISION = 18;

async function main() {
  const cctpBridgeSource = loadSolSource('CctpBridge');

  assertContainsSafeERC20(cctpBridgeSource);

  const chainId = +getEnv('CHAIN_ID');
  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');
  const cctpMessengerAddress = getEnv('CCTP_MESSENGER_ADDRESS');
  const cctpTransmitterAddress = getEnv('CCTP_TRANSMITTER_ADDRESS');

  const Contract = await ethers.getContractFactory('CctpBridge');
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
