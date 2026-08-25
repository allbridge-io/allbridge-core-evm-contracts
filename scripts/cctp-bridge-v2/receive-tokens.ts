import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const extraGasAmount = 1000000000000n;
const isTestnet = true;
const sendTxId = '0xfaed602acb8203e5279b01807655f698836cca31c709bb55c3002e522596d663';
const sendDomain = '27';
const recipient = '';

async function main() {
  const CctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const signer = (await ethers.getSigners())[0];

  const CctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', CctpV2BridgeAddress);
  const signature = await getSignature(sendDomain, sendTxId);

  const recipientAddress = recipient || signer.address;
  const messageId = +sendDomain === 5 ? ethers.utils.keccak256(Buffer.from(signature.message)) : sendTxId;
  const result = await CctpV2Bridge.receiveTokens(
    recipientAddress,
    messageId,
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
    const url = `${irisUrl}/v2/messages/${sourceDomainId}?transactionHash=${txId.replace(/^0x/i, '')}`;
    const response = await fetch(url);
    const json = await response.json();
    message = json?.messages?.[0] as any;
    console.log('message:', JSON.stringify(message, null, 2));
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }

  return message;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
