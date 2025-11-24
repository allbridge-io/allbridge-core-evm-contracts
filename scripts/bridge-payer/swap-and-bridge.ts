import { ethers } from 'hardhat';
import { addressToBytes32, getEnv, handleTransactionResult, tronAddressToBytes32 } from '../helper';
import { formatUnits, parseUnits } from 'ethers/lib/utils';

const destinationChainId = 4; // TRX
const messengerProtocol = 1;
/* cSpell:disable */
const receiveTokenBytes32 = tronAddressToBytes32('TS7Aqd75LprBKkPPxVLuZ8WWEyULEQFF1U');
const recipientBytes32 = tronAddressToBytes32('TSy1vfxHoFizuMLimSVLrYCaipXmGyKvAW');
/* cSpell:enable */
const tokenAmount = '5.0';

async function main() {
  const payerAddress = getEnv('BRIDGE_PAYER_ADDRESS');
  const abrTokenAddress = getEnv('ABR_TOKEN_ADDRESS');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');
  const tokenAddress = getEnv('TOKEN_ADDRESS');
  const abrToken = await ethers.getContractAt('Token', abrTokenAddress);
  const payer = await ethers.getContractAt('BridgePayerWithToken', payerAddress);

  const feeAbrAmount = await payer.getBridgeFeeInAbr(
    destinationChainId,
    messengerProtocol,
  );
  const abrDecimals = await abrToken.decimals();
  const abrSymbol = await abrToken.symbol();
  console.log(`Bridging cost: ${formatUnits(feeAbrAmount, abrDecimals)} ${abrSymbol}`);

  const bridge = await ethers.getContractAt('Bridge', bridgeAddress);

  const currentBalance = await ethers.provider.getBalance(payerAddress);
  console.log(`Bridge Payer balance is ${formatUnits(currentBalance)}`);
  const transactionCost = await bridge.getTransactionCost(destinationChainId);
  const messageCost = await bridge.getMessageCost(destinationChainId, messengerProtocol);
  const requiredPayerBalance = transactionCost.add(messageCost);
  if (currentBalance.lt(requiredPayerBalance)) {
    throw Error(`Bridge Payer balance is too low. Refill address ${payerAddress}`);
  }

  const signer = (await ethers.getSigners())[0];

  const token = await ethers.getContractAt('Token', tokenAddress);
  if ((await token.allowance(signer.address, payer.address)).isZero()) {
    console.log('Approve bridge payer contract');
    await handleTransactionResult(
      await token.approve(payer.address, ethers.constants.MaxUint256),
    );
  }
  if ((await abrToken.allowance(signer.address, payer.address)).isZero()) {
    console.log('Approve bridge payer contract');
    await handleTransactionResult(
      await abrToken.approve(payer.address, ethers.constants.MaxUint256),
    );
  }

  const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));

  const tokenSymbol = await token.symbol();
  console.log(
    `Sending ${tokenAmount} ${tokenSymbol} to chain ${destinationChainId}`,
  );
  const result = await payer.swapAndBridge(
    addressToBytes32(tokenAddress),
    parseUnits(tokenAmount, await token.decimals()),
    recipientBytes32,
    destinationChainId,
    receiveTokenBytes32,
    nonce,
    messengerProtocol,
    feeAbrAmount,
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
