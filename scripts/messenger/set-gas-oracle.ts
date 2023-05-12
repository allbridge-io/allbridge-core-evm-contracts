import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }
  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address');
  }

  const contract = await ethers.getContractAt('Messenger', messengerAddress);
  const result = await contract.setGasOracle(gasOracleAddress);
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
