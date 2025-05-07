import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

// solana = 0.000015 fee + 0.00123996 account = 0.00125496 ≈ 1300K lamports (1000 lamport)

const gasUsagePerChain = [
  [1, 100_000],
  [2, 100_000],
  [3, 100_000],
  [4, 1_300],
  [5, 100_000],
  [6, 100_000],
  [7, 50],
  [8, 100_000],
  [10, 100_000],
];

async function main() {
  const currentChainId = getEnv('CHAIN_ID');
  const messengerAddress = getEnv('MESSENGER_ADDRESS');

  const contract = await ethers.getContractAt('Messenger', messengerAddress);

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
