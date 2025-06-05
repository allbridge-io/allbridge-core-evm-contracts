import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const oftBridgeAddress = process.env.OFT_BRIDGE_ADDRESS;
  if (!oftBridgeAddress) {
    throw new Error('No oft bridge address');
  }

  const oftAddress = process.env.OFT_TOKEN;
  if (!oftAddress) {
    throw new Error('No token address');
  }
  const oftContract = await ethers.getContractAt('IOFT', oftAddress);

  const tokenAddress = await oftContract.token();
  const token = await ethers.getContractAt('ERC20', tokenAddress);
  await handleTransactionResult(
    await token.approve(oftBridgeAddress, ethers.constants.MaxUint256),
  );

  const contract = await ethers.getContractAt('OftBridge', oftBridgeAddress);
  const result = await contract.bridge(
    tokenAddress,
    '1000000000000000000',
    '0x000000000000000000000000be959eed208225aab424505569d41bf3212142c0',
    2,
    0,
    0,
    0,
    { value: '0x6b9e6df7d5630', gasLimit: '500000' },
  );
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
