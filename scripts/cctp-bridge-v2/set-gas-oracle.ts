import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

async function main() {
  const cctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const gasOracleAddress = getEnv('GAS_ORACLE_ADDRESS');
  const cctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', cctpV2BridgeAddress);

  const result = await cctpV2Bridge.setGasOracle(gasOracleAddress);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
