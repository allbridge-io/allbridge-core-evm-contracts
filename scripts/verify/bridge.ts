import hre from 'hardhat';

const CHAIN_PRECISION = 18;

async function main() {

  const chainId = process.env.CHAIN_ID ? +process.env.CHAIN_ID : undefined;
  if (!chainId) {
    throw new Error('No chain id');
  }

  const messengerAddress = process.env.MESSENGER_ADDRESS;
  if (!messengerAddress) {
    throw new Error('No messenger address');
  }

  const wormholeMessengerAddress = process.env.WORMHOLE_MESSENGER_ADDRESS;
  if (!wormholeMessengerAddress) {
    throw new Error('No wormhole messenger address');
  }

  const gasOracleAddress = process.env.GAS_ORACLE_ADDRESS;
  if (!gasOracleAddress) {
    throw new Error('No gas oracle address address');
  }
  const bridgeAddress = process.env.BRIDGE_ADDRESS;

  await hre.run("verify:verify", {
    address: bridgeAddress,
    constructorArguments: [
      chainId,
      CHAIN_PRECISION,
      messengerAddress,
      wormholeMessengerAddress,
      gasOracleAddress,
    ],
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
