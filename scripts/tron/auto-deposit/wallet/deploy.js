const { callContract, getContract, tronAddressToBuffer32, ethAddressToBytes32 } = require('../../helper');

(async function () {
  const autoDepositFactoryAddress = process.env.AUTO_DEPOSIT_FACTORY_ADDRESS;
  if (!autoDepositFactoryAddress) {
    throw new Error('No auto deposit factory address');
  }

  const bridgeAddress = process.env.BRIDGE_ADDRESS;
  if (!bridgeAddress) {
    throw new Error('No bridge address');
  }

  const ownerAddress = process.env.OWNER;
  if (!ownerAddress) {
    throw new Error('No owner address');
  }

  const recipientChainId = 2;
  const recipient = ethAddressToBytes32(ownerAddress);
  const recipientToken = ethAddressToBytes32('0x1c7d4b196cb0c7b01d743fbc6116a902379c7238');
  const minDepositTokens = 1;
  const predictedAddress = await getContract(
    "AutoDepositFactory",
    autoDepositFactoryAddress,
    "getDepositWalletAddress",
    recipientChainId,
    bridgeAddress,
    recipient,
    recipientToken,
    minDepositTokens,
  );
  console.log('Deploy to', predictedAddress);

  const result = await callContract(
    'AutoDepositFactory',
    autoDepositFactoryAddress,
    'deployDepositWallet',
    recipientChainId,
    bridgeAddress,
    recipient,
    recipientToken,
    minDepositTokens,
  );
  console.log(result);
})();
