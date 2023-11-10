import { ethers } from 'hardhat';
import {
  addressToBytes32,
  handleTransactionResult,
  solanaAddressToBytes32,
} from '../helper';

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

  await handleTransactionResult(
    /* cSpell:disable */
    await bridge.swapAndBridge(
      addressToBytes32(tokenAddress),
      '1' + '0'.repeat(await token.decimals()),
      // addressToBytes32('0xBe959EED208225aAB424505569d41BF3212142C0'),
      solanaAddressToBytes32('BHzPDHXSPmYRUXQvJ2sgbFgghXvbkKQKr2UdCCBo1qad'), // user address
      5,
      // addressToBytes32('0xC7DBC4A896b34B7a10ddA2ef72052145A9122F43'),
      solanaAddressToBytes32('f4yhod6Y7jzVwFfy3iHDg49GAerFTrtp1Ac1ubdWx7L'), // mint address
      9,
      2,
      0
    ),
    /* cSpell:enable */
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
