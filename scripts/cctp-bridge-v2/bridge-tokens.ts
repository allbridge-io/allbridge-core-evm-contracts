import { ethers } from 'hardhat';
import {
  addressToBytes32, getEnv,
  handleTransactionResult,
} from '../helper';
import { parseEther, parseUnits } from 'ethers/lib/utils';

const destinationChainId = 9;
const totalTokens = '0.1';
const extraGas = parseEther('0');

async function main() {
  const CctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');

  const signer = (await ethers.getSigners())[0];

  const CctpV2Bridge = await ethers.getContractAt('CctpV2Bridge', CctpV2BridgeAddress);

  const bridgingFee = await CctpV2Bridge.getTransactionCost(destinationChainId);
  console.log('To send ', JSON.stringify({ totalTokens, bridgingFee: bridgingFee.toString(), extraGas: extraGas.toString() }, null, 2));

  const token = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    usdcAddress,
  );
  const tokenDecimals = await token.decimals();
  const totalTokensAmount = parseUnits(totalTokens, tokenDecimals);

  // approve CCTP bridge
  if ((await token.allowance(signer.address, CctpV2Bridge.address)).lt(totalTokensAmount)) {
    console.log('Approve CCTP Bridge');
    await handleTransactionResult(
      await token.approve(CctpV2Bridge.address, ethers.constants.MaxUint256),
    );
  }
  try {
    const result = await CctpV2Bridge.bridge(
      totalTokensAmount,
      addressToBytes32(signer.address),
      destinationChainId,
      '0',
      { value: bridgingFee.add(extraGas) },
    );
    await handleTransactionResult(result);
  } catch (e) {
    console.error('Error while bridging:', e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
