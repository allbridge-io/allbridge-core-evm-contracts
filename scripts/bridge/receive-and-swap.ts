import { ethers } from 'hardhat';
import { addressToBytes32, handleTransactionResult } from '../helper';
import { parseUnits } from 'ethers/lib/utils';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const bridge = await ethers.getContractAt('Bridge', bridgeAddress);
  const amount = parseUnits('1000', 3);
  const recipient = addressToBytes32('0xBe959EED208225aAB424505569d41BF3212142C0');
  const sourceChainId = 1;
  const token = addressToBytes32('0x55d398326f99059fF775485246999027B3197955');
  const nonce = 123;
  const messenger = 0;
  const receiveAmountMin = 0;
  await handleTransactionResult(
    await bridge.receiveTokens(
      amount,
      recipient,
      sourceChainId,
      token,
      nonce,
      messenger,
      receiveAmountMin,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
