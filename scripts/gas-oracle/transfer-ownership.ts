import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address');
  }

  const contract = await ethers.getContractAt('GasOracle', gasOracleAddress);
  const result = await contract.transferOwnership('0x8d19c0d02c0e83e4be9523927c0e6de07c5123d7');
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
