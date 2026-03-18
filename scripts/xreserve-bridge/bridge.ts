import { ethers } from 'hardhat';
import {
  addressToBytes32, getEnv,
  handleTransactionResult,
} from '../helper';
import { parseUnits } from 'ethers/lib/utils';

const destinationChainId = 16;
const totalTokens = process.env.TOTAL_TOKENS || '50';
const recipient = '0x1ad8984e1d33e1ff33dc04d22af791c101c2a12e18';

async function main() {
  const xReserveBridgeAddress = getEnv('X_RESERVE_BRIDGE_ADDRESS');
  const tokenAddress = getEnv('USDC_ADDRESS');

  const signer = (await ethers.getSigners())[0];

  const xReserveBridge = await ethers.getContractAt('XReserveBridge', xReserveBridgeAddress);

  console.log('To send ', JSON.stringify({
    totalTokens: totalTokens,
  }, null, 2));

  const token = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    tokenAddress,
  );
  const tokenDecimals = await token.decimals();
  const totalTokensAmount = parseUnits(totalTokens, tokenDecimals);

  // approve XReserve bridge
  if ((await token.allowance(signer.address, xReserveBridge.address)).lt(totalTokensAmount)) {
    console.log('Approve XReserve Bridge');
    await handleTransactionResult(
      await token.approve(xReserveBridge.address, ethers.constants.MaxUint256),
    );
  }

  const result = await xReserveBridge.bridge(
    totalTokensAmount,
    addressToBytes32(recipient),
    destinationChainId,
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
