import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

// solana = 0.000005 fee + 0.001392 lock + 0.00203928 user token = 0.0034362 ≈ 3500K lamports (1000 lamport)

const gasUsagePerChain = [
  [1, 250_000],
  [2, 250_000],
  [3, 150_000],
  [4, 3_500],
  [5, 250_000],
  [6, 250_000],
  [7, 50],
  [8, 200_000],
  [10, 250_000],
];

async function main() {
  const currentChainId = getEnv('CHAIN_ID');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);

  for (const [chainId, gasUsage] of gasUsagePerChain) {
    if (+currentChainId === chainId) continue;

    const currentGasUsage = await contract.gasUsage(chainId);
    console.log(
      `Chain ID: ${chainId} Current gas usage: ${currentGasUsage.toString()})`,
    );

    if (!currentGasUsage.eq(gasUsage)) {
      console.log(`Set gas usage ${gasUsage}`);
      await handleTransactionResult(
        await contract.setGasUsage(chainId, gasUsage),
      );
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
