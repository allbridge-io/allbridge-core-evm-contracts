import { ethers } from 'hardhat';

async function main() {
  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oraclt address');
  }

  const contract = await ethers.getContractAt('GasOracle', gasOracleAddress);
  const result = await contract.chainData(4);
  console.log(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
