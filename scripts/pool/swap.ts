import { ethers } from 'hardhat';
import { addressToBytes32, handleTransactionResult } from '../helper';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const tokenAddress = process.env.TOKEN_ADDRESS;
  if (!tokenAddress) {
    throw new Error('No token address');
  }

  const signer = (await ethers.getSigners())[0];

  const bridge = await ethers.getContractAt('Bridge', bridgeAddress);
  const token = await ethers.getContractAt('Token', tokenAddress);
  const pool = await ethers.getContractAt(
    'Pool',
    await bridge.pools(addressToBytes32(tokenAddress)),
  );
  if ((await token.allowance(signer.address, pool.address)).isZero()) {
    await handleTransactionResult(
      await token.approve(pool.address, ethers.constants.MaxUint256),
    );
  }

  const amount = '1' + '0'.repeat(await token.decimals());

  await handleTransactionResult(
    await bridge.swap(
      amount,
      addressToBytes32(tokenAddress),
      addressToBytes32('0xC7DBC4A896b34B7a10ddA2ef72052145A9122F43'),
      signer.address,
      0
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
