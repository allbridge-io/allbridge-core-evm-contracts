import { ethers } from 'hardhat';
import { addressToBytes32, getEnv, handleTransactionResult, tronAddressToBytes32 } from '../helper';
import { formatUnits, parseUnits } from 'ethers/lib/utils';

const messengerProtocol = 1;
const destinationChainId = 4; // TRX
/* cSpell:disable */
const receiveTokenBytes32 = tronAddressToBytes32('TS7Aqd75LprBKkPPxVLuZ8WWEyULEQFF1U');
const recipientBytes32 = tronAddressToBytes32('TSy1vfxHoFizuMLimSVLrYCaipXmGyKvAW');
/* cSpell:enable */
const tokenAmount = '5.0';

async function main() {
  const payerAddress = getEnv('ABR_PAYER_ADDRESS');
  const abrTokenAddress = getEnv('ABR_TOKEN_ADDRESS');
  const bridgeAddress = getEnv('BRIDGE_ADDRESS');
  const tokenAddress = getEnv('TOKEN_ADDRESS');
  const abrToken = await ethers.getContractAt('Token', abrTokenAddress);
  const payer = await ethers.getContractAt('PayerWithAbr', payerAddress);
  const bridge = await ethers.getContractAt('Bridge', bridgeAddress);

  const transactionCost = await bridge.getTransactionCost(
    destinationChainId,
  );
  const messageCost = await bridge.getMessageCost(
    destinationChainId,
    messengerProtocol,
  );
  const totalBridgingCost = transactionCost.add(messageCost);

  const feeAbrAmount = await payer.nativeTokensToAbr(
    totalBridgingCost,
  );
  const abrDecimals = await abrToken.decimals();
  const abrSymbol = await abrToken.symbol();
  console.log(`Bridging cost: ${formatUnits(feeAbrAmount, abrDecimals)} ${abrSymbol}`);

  const signer = (await ethers.getSigners())[0];

  const currentBalanceAbr = await abrToken.balanceOf(signer.address);
  console.log(`Sender ${abrSymbol} balance is ${formatUnits(currentBalanceAbr)}`);
  if (currentBalanceAbr.lt(feeAbrAmount)) {
    console.log(`Not enough ${abrSymbol}. Refill address ${signer.address}`);
    return;
  }

  const currentBalance = await ethers.provider.getBalance(payerAddress);
  console.log(`Payer balance is ${formatUnits(currentBalance)}`);
  console.log(`Required Payer balance is ${formatUnits(totalBridgingCost)}`);
  if (currentBalance.lt(totalBridgingCost)) {
    throw Error(`Payer balance is too low. Refill address ${payerAddress}`);
  }

  const token = await ethers.getContractAt('Token', tokenAddress);
  if ((await token.allowance(signer.address, payer.address)).isZero()) {
    console.log('Approve Payer contract');
    await handleTransactionResult(
      await token.approve(payer.address, ethers.constants.MaxUint256),
    );
  }
  if ((await abrToken.allowance(signer.address, payer.address)).isZero()) {
    console.log('Approve Payer contract');
    await handleTransactionResult(
      await abrToken.approve(payer.address, ethers.constants.MaxUint256),
    );
  }

  const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));

  const tokenSymbol = await token.symbol();
  console.log(
    `Sending ${tokenAmount} ${tokenSymbol} to chain ${destinationChainId}`,
  );
  const amount = parseUnits(tokenAmount, await token.decimals());
  const currentTokenBalance = await token.balanceOf(signer.address);
  console.log(`Sender ${tokenSymbol} balance is ${formatUnits(currentTokenBalance)}`);
  if (currentTokenBalance.lt(amount)) {
    console.log(`Not enough ${tokenSymbol}. Refill address ${signer.address}`);
    return;
  }
  const coder = ethers.utils.defaultAbiCoder;
  const params = coder.encode(['bytes32','uint256','bytes32','uint256','bytes32','uint256','uint8','uint256'], [
    addressToBytes32(tokenAddress),
    amount,
    recipientBytes32,
    destinationChainId,
    receiveTokenBytes32,
    nonce,
    messengerProtocol,
    '0',
  ]);

  const result = await payer.transferTokensAndCallTarget(
    tokenAddress,
    amount,
    feeAbrAmount,
    messengerProtocol,
    params,
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
