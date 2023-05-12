import { ethers } from 'hardhat';
import { handleTransactionResult } from '../helper';

async function main() {
  const wormholeMessengerAddress = process.env.WORMHOLE_MESSENGER_ADDRESS;
  if (!wormholeMessengerAddress) {
    throw new Error('No wormhole messenger address');
  }

  const contract = await ethers.getContractAt(
    'WormholeMessenger',
    wormholeMessengerAddress,
  );

  await handleTransactionResult(
    await contract.receiveMessage(
      Buffer.from(
        'AQAAAAABAFHlOkf3zTWc63Ihp1hinbifQ5AvWWOxFSbX9I3xio8AWW9vdnpwpHRhGba4SrTSS18p3BWrN1kYUKfSQ+hv6/MAYuD9ygAAAAAAAgAAAAAAAAAAAAAAADiD8qPSvIXEGtOdi8b2tzjHTC2LAAAAAAAAAAABAgMm+tuj+UARZIMQEfJDloaWhBOILMKSqBJifLsLaw4=',
        'base64',
      ),
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
