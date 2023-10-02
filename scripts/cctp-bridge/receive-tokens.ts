import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult, } from '../helper';

const extraGasAmount = '1000';
// get sentMessage by running the script `get-sent-message.ts` on the source chain
const sentMessage = '0x000000000000000300000000000000000000023400000000000000000000000012dcfd3fe2e9eac2859fd1ed86d2ab8c5a2f9352000000000000000000000000d0c3da58f55358142b8d3e06c1c30c5c6114efe8000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000fd064a18f3bf249cf1f87fc203e90d8f650f2d630000000000000000000000009aca1c932640a5743b777162d6d3c6196053596e00000000000000000000000000000000000000000000000000000000000309580000000000000000000000009628181b44b5f80888e6d2555f3116f3f7e24502';
const isTestnet = true;

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const signer = (await ethers.getSigners())[0];

  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);

  const messageHash = ethers.utils.keccak256(sentMessage);
  const signature = await getSignature(messageHash);
  console.log('signature:', signature);

  const result = await cctpBridge.receiveTokens(
    signer.address,
    sentMessage,
    signature,
    { value: extraGasAmount },
  );
  await handleTransactionResult(result);
}

async function getSignature(messageHash: string) {
  let attestationResponse = { status: '', attestation: '' };
  while (attestationResponse?.status !== 'complete') {
    console.log('Request signature...');
    const irisUrl = isTestnet ? 'https://iris-api-sandbox.circle.com' : 'https://iris-api.circle.com';
    const response = await fetch(`${irisUrl}/attestations/${messageHash}`);
    attestationResponse = await response.json();

    console.log('attestationResponse:', JSON.stringify(attestationResponse, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return attestationResponse.attestation;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
