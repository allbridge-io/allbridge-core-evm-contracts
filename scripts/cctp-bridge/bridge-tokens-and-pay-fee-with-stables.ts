import { ethers } from 'hardhat';
import {
  addressToBytes32, getEnv,
  handleTransactionResult,
} from '../helper';
import { formatUnits, parseUnits } from 'ethers/lib/utils';
import { Big } from 'big.js';

const tokensToBridge = '0.3';
const extraGasTokens = '0.01';

const destinationChainId = 6;

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');

  const signer = (await ethers.getSigners())[0];

  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);
  const token = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    usdcAddress,
  );
  const tokenDecimals = await token.decimals();

  const bridgingFeeTokensAmount = await cctpBridge.getBridgingCostInTokens(
    destinationChainId,
  );
  const bridgingFeeTokens = formatUnits(bridgingFeeTokensAmount, tokenDecimals);

  const totalTokens = Big(tokensToBridge).add(bridgingFeeTokens.toString()).add(extraGasTokens).toFixed();
  const totalTokensAmount = parseUnits(totalTokens, tokenDecimals);
  console.log('To send ', JSON.stringify({ tokensToBridge: tokensToBridge, bridgingFeeTokens: bridgingFeeTokens.toString(), extraGasTokens: extraGasTokens, totalTokens: totalTokens }, null, 2));

  // approve CCTP bridge
  if ((await token.allowance(signer.address, cctpBridge.address)).lt(totalTokensAmount)) {
    console.log('Approve CCTP Bridge');
    await handleTransactionResult(
      await token.approve(cctpBridge.address, ethers.constants.MaxUint256),
    );
  }

  const tokensToGas = Big(bridgingFeeTokens).add(extraGasTokens).toFixed();
  const result = await cctpBridge.bridge(
    totalTokensAmount,
    addressToBytes32(signer.address),
    destinationChainId,
    parseUnits(tokensToGas, tokenDecimals),
    { value: '0' },
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
