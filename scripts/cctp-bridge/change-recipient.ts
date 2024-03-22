import { ethers } from 'hardhat';
import {
  getEnv,
  handleTransactionResult,
} from '../helper';

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');

  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);
  const originalMessage = '0x';
  const originalAttestation = '0x';
  const newRecipient = '0x';

  const result = await cctpBridge.changeRecipient(
    originalMessage,
    originalAttestation,
    newRecipient,
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
