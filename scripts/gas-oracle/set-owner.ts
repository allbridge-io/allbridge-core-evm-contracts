import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address');
  }

  const newOwner = process.env.OWNER;
  if (!newOwner) {
    throw new Error('No owner address');
  }

  const contract = await ethers.getContractAt('GasOracle', gasOracleAddress);
  const result = await contract.transferOwnership(newOwner);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
