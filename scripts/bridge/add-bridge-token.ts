import { ethers } from 'hardhat';
import { 
  handleTransactionResult,
  addressToBytes32,
  solanaAddressToBytes32, 
  tronAddressToBytes32 
} from '../helper';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  const result = await contract.addBridgeToken(
    5,
    // tronAddressToBytes32('TS7Aqd75LprBKkPPxVLuZ8WWEyULEQFF1U'),
    // addressToBytes32('0xDdaC3cb57DEa3fBEFF4997d78215535Eb5787117'),
    solanaAddressToBytes32('FpGHqNpwDctcaJyu24M9E2ydTe5owPQgD7UdarKEJHd4'), // mint address
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
