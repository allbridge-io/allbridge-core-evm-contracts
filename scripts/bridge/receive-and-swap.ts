import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const bridge = await ethers.getContractAt('Bridge', bridgeAddress);
  // const pool = await ethers.getContractAt(
  //   'Pool',
  //   await stableSwap.poolList(TOKEN_ID),
  // );
  // const token = await ethers.getContractAt('Token', await pool.token());
  // await handleTransactionResult(
  //   await token.approve(pool.address, ethers.constants.MaxUint256),
  // );

  await handleTransactionResult(
    await bridge.receiveTokens(
      '0x00de0b60980000000',
      '0xBe959EED208225aAB424505569d41BF3212142C0000000000000000000000000',
      1,
      2,
      123,
      0,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
