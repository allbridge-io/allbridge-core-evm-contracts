import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const extraGasAmount = 1000000000000n;
const isTestnet = true;

async function main() {
  const CctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const signer = (await ethers.getSigners())[0];

  const CctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', CctpV2BridgeAddress);
  const sendTxId = '0x1ffeca530f29fe9df45579fe14996de50f1db58e4acd08d75bd2accb8461c82f';
  const sendDomain = '0';

  const signature = await getSignature(sendDomain, sendTxId);

  const recipientAddress = '0x9aca1c932640a5743B777162d6D3c6196053596e';
  // const recipientAddress = signer.address;
  const result = await CctpV2Bridge.receiveTokens(
    recipientAddress,
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
