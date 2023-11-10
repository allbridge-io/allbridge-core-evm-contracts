import { ethers } from 'hardhat';
import {
  addressToBytes32, getEnv,
  handleTransactionResult,
} from '../helper';
import { parseEther, parseUnits } from 'ethers/lib/utils';

const destinationChainId = 6;
const totalTokens = '0.1';
const extraGas = parseEther('0.1');

async function main() {
  const cctpBridgeAddress = getEnv('CCTP_BRIDGE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');

  const signer = (await ethers.getSigners())[0];

  const cctpBridge = await ethers.getContractAt('CctpBridge', cctpBridgeAddress);

  const bridgingFee = await cctpBridge.getTransactionCost(destinationChainId);
  console.log('To send ', JSON.stringify({ totalTokens: totalTokens, bridgingFee: bridgingFee.toString(), extraGas: extraGas.toString() }, null, 2));

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
    '0',
    { value: bridgingFee.add(extraGas) },
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
