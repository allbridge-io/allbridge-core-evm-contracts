import { ethers } from 'hardhat';
import {
    handleTransactionResult,
    solanaAddressToBytes32,
    addressToBytes32,
    tronAddressToBytes32
} from '../helper';

async function main() {
  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const contract = await ethers.getContractAt('Bridge', bridgeAddress);
  /* cSpell:disable */
  const result = await contract.registerBridge(
    5,
    // tronAddressToBytes32('TQMRDKiDB86vRVBdcQjt6C7RUe1JhXXPMe'),
    // addressToBytes32('0xba285A8F52601EabCc769706FcBDe2645aa0AF18'),
    solanaAddressToBytes32('ERrse1kNoZPcY2BjRXQ5rHTCPDPwL1m2NQ2sGSj6cW7C'), // authority address
  );
  /* cSpell:enable */
  await handleTransactionResult(result);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
