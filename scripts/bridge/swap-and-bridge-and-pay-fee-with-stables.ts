import { ethers } from 'hardhat';
import {
  addressToBytes32,
  getRequiredEnvVariable,
  handleTransactionResult,
  tronAddressToBytes32,
} from '../helper';
import { formatUnits, parseUnits } from 'ethers/lib/utils';

async function main() {
  const bridgeAddress = getRequiredEnvVariable('BRIDGE_ADDRESS');
  const tokenAddress = getRequiredEnvVariable('TOKEN_ADDRESS');

  const currentBalance = await ethers.provider.getBalance(bridgeAddress);
  console.log(`Bridge balance is ${formatUnits(currentBalance)}`);
  if (currentBalance.isZero()) {
    throw Error(`Bridge balance is too low. Refill address ${bridgeAddress}`);
  }

  const signer = (await ethers.getSigners())[0];

  const bridge = await ethers.getContractAt('Bridge', bridgeAddress);
  const token = await ethers.getContractAt('Token', tokenAddress);

  if ((await token.allowance(signer.address, bridge.address)).isZero()) {
    console.log('Approve bridge contract');
    await handleTransactionResult(
      await token.approve(bridge.address, ethers.constants.MaxUint256),
    );
  }

  const destinationChainId = 4; // TRX
  /* cSpell:disable */
  const receiveTokenAddressBytes32 = tronAddressToBytes32(
    'TS7Aqd75LprBKkPPxVLuZ8WWEyULEQFF1U',
  );
  const receiveAddressBytes32 = tronAddressToBytes32(
    'TSy1vfxHoFizuMLimSVLrYCaipXmGyKvAW',
  );
  /* cSpell:enable */
  const totalAmount = '50';
  const feeAmount = '30';
  const messengerProtocol = 1;
  const nonce = ethers.BigNumber.from(ethers.utils.randomBytes(32));

  const tokenSymbol = await token.symbol();
  console.log(
    `Sending ${totalAmount} ${tokenSymbol} including ${feeAmount} ${tokenSymbol}`,
  );
  const result = await bridge.swapAndBridge(
    addressToBytes32(tokenAddress),
    parseUnits(totalAmount, await token.decimals()),
    receiveAddressBytes32,
    destinationChainId,
    receiveTokenAddressBytes32,
    nonce,
    messengerProtocol,
    parseUnits(feeAmount, await token.decimals()),
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
