import { ethers } from 'hardhat';
import { handleDeployResult } from '../helper';

async function main() {
  const chainId = process.env.CHAIN_ID ? +process.env.CHAIN_ID : undefined;
  if (!chainId) {
    throw new Error('No chain id');
  }

  const wormholeAddress = process.env.WORMHOLE_ADDRESS;
  if (!wormholeAddress) {
    throw new Error('No wormhole address');
  }

  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address');
  }

  const commitment = process.env.COMMITMENT_LEVEL;
  if (!commitment) {
    throw new Error('No commitment level');
  }

  const otherChainIds = Buffer.from([
    0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0,
  ]);
  otherChainIds[chainId] = 0;

  const Contract = await ethers.getContractFactory('WormholeMessenger');
  const contract = await Contract.deploy(
    chainId,
    otherChainIds,
    wormholeAddress,
    commitment,
    gasOracleAddress,
  );

  await handleDeployResult(contract);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
