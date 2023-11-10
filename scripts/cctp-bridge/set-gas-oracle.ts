import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');
  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);

  const result = await cctpBridge.setGasOracle(gasOracleAddress);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
