import { ethers } from 'hardhat';
import {
  addressToBytes32, getEnv,
  handleTransactionResult,
} from '../helper';
import { parseUnits } from 'ethers/lib/utils';

const destinationDomain = 1;
const totalTokens = '0.1';

async function main() {
  const CctpV2BridgeAddress = getEnv('CCTP_V2_MESSENGER_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');

  const signer = (await ethers.getSigners())[0];

  const CctpV2Bridge = await ethers.getContractAt('ITokenMessengerV2', CctpV2BridgeAddress);


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
    const result = await CctpV2Bridge.depositForBurn(
      totalTokensAmount,
      destinationDomain,
      addressToBytes32(signer.address),
      usdcAddress,
      '0x0000000000000000000000000000000000000000000000000000000000000000',
      totalTokensAmount.sub(1),
      1000,
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
