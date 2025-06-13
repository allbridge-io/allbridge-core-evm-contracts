import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const extraGasAmount = 0n;
// get sentMessage by running the script `get-sent-message.ts` on the source chain
const isTestnet = true;

async function main() {
  const CctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const signer = (await ethers.getSigners())[0];

  const CctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', CctpV2BridgeAddress);
  const sendTxId = '';
  const sendDomain = '';

  const signature = await getSignature(sendDomain, sendTxId);

  const result = await CctpV2Bridge.receiveTokens(
    signer.address,
    sendTxId,
    signature.message,
    signature.attestation,
    { value: extraGasAmount },
  );
  await handleTransactionResult(result);
}

async function getSignature(sourceDomainId: string, txId: string): Promise<{ message: string; attestation: string }> {
  let message = { message: '', attestation: '', status: '' };
  while (message?.status !== 'complete') {
    console.log('Request signature...');
    const irisUrl = isTestnet ? 'https://iris-api-sandbox.circle.com' : 'https://iris-api.circle.com';
    const response = await fetch(`${irisUrl}/v2/messages/${sourceDomainId}?transactionHash=${txId}`);
    message = (await response.json())?.data?.messages?.[0] as any;

    console.log('message:', JSON.stringify(message, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return message;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
