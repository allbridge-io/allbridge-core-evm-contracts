import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult, } from '../helper';

const extraGasAmount = '1000';

const sentMessage = '0x000000000000000000000003000000000003965b000000000000000000000000d0c3da58f55358142b8d3e06c1c30c5c6114efe800000000000000000000000012dcfd3fe2e9eac2859fd1ed86d2ab8c5a2f935200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007865c6e87b9f70255377e024ace6630c1eaa37f0000000000000000000000009aca1c932640a5743b777162d6d3c6196053596e000000000000000000000000000000000000000000000000000000000001fbd00000000000000000000000005232fca9c8642b03036c5246718a5ba458641e2a';
const messageHash = ethers.utils.keccak256(sentMessage);
const isTestnet = true;

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const signer = (await ethers.getSigners())[0];

  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);

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
    const irisUrl = isTestnet ? 'https://iris-api-sandbox.circle.com' : 'https://api.circle.com';
    const response = await fetch(`${irisUrl}/attestations/${messageHash}`);
    attestationResponse = await response.json();

    console.log('attestationResponse=', JSON.stringify(attestationResponse, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  return attestationResponse.attestation;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
