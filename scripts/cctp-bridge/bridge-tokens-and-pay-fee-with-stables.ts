import { ethers } from 'hardhat';
import {
  addressToBytes32, getEnv,
  handleTransactionResult,
} from '../helper';
import { parseUnits } from 'ethers/lib/utils';

const totalTokens = '0.30';
const bridgingFeeTokens = '0.17';
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
  const totalTokensAmount = parseUnits(totalTokens, tokenDecimals);

  // approve CCTP bridge
  if ((await token.allowance(signer.address, cctpBridge.address)).lt(totalTokensAmount)) {
    console.log('Approve CCTP Bridge');
    await handleTransactionResult(
      await token.approve(cctpBridge.address, ethers.constants.MaxUint256),
    );
  }

  const result = await cctpBridge.bridge(
    totalTokensAmount,
    addressToBytes32(signer.address),
    destinationChainId,
    parseUnits(bridgingFeeTokens, tokenDecimals),
    { value: '0' },
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});