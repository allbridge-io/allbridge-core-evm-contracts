import { ethers } from 'hardhat';
import { handleDeployResult } from '../helper';

async function main() {
  const Contract = await ethers.getContractFactory('Token');
  // const contract = await Contract.deploy(
  //   'USDY',
  //   'USDY',
  //   '1000000000000' + '0'.repeat(6),
  //   6,
  // );

  const contract = await Contract.deploy(
    'YARO',
    'YARO',
    '1000000000' + '0'.repeat(18),
    18,
  );
  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
