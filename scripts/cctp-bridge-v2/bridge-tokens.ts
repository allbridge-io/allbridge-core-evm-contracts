import { ethers } from 'hardhat';
import {
  addressToBytes32,
  getEnv,
  handleTransactionResult,
  sorobanAddressToBytes32,
  solanaAddressToBytes32,
  SRB_CHAIN_ID,
  getCctpToStellarHookData,
} from '../helper';
import { parseEther, parseUnits } from 'ethers/lib/utils';

const recipient = addressToBytes32(
  '0x0000000000000000000000000000000000000000',
);
const recipientWalletAddressHex = undefined;
// const recipientWalletAddressHex = solanaAddressToBytes32('');
// const recipient = solanaAddressToBytes32(''); // recipient token account
const destinationChainId: number = 7;
const totalTokens = '1.0';
const extraGas = parseEther('0.0');
/* cSpell:disable */
const SRB_BRIDGE_ADDRESS =
  'CAYUCAP2ORC5PSASKC63MQGMB6X62YXDADCSPDBZNHHHG33GKNZUYROB';
const SRB_FINAL_RECIPIENT = 'GA7BQD4JKXZML7FVKJ25MDVEQPV56VDBMCBXDMEZQ6FMPBEMV6Q6MKTC';
/* cSpell:enable */

async function main() {
  const CctpV2BridgeAddress = getEnv('CCTP_V2_BRIDGE_ADDRESS');
  const usdcAddress = getEnv('USDC_ADDRESS');

  const signer = (await ethers.getSigners())[0];

  const CctpV2Bridge = await ethers.getContractAt(
    'CctpV2Bridge',
    CctpV2BridgeAddress,
  );

  const bridgingFee = await CctpV2Bridge.getTransactionCost(destinationChainId);
  console.log(
    'To send ',
    JSON.stringify(
      {
        totalTokens,
        bridgingFee: bridgingFee.toString(),
        extraGas: extraGas.toString(),
      },
      null,
      2,
    ),
  );

  const token = await ethers.getContractAt(
    '@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20',
    usdcAddress,
  );
  const tokenDecimals = await token.decimals();
  const totalTokensAmount = parseUnits(totalTokens, tokenDecimals);

  // approve CCTP bridge
  if (
    (await token.allowance(signer.address, CctpV2Bridge.address)).lt(
      totalTokensAmount,
    )
  ) {
    console.log('Approve CCTP Bridge');
    await handleTransactionResult(
      await token.approve(CctpV2Bridge.address, ethers.constants.MaxUint256),
    );
  }
  const recipientHex32 = recipient ?? addressToBytes32(signer.address);
  try {
    if (destinationChainId === SRB_CHAIN_ID) {
      const result = await CctpV2Bridge.bridgeWithHook(
        totalTokensAmount,
        sorobanAddressToBytes32(SRB_BRIDGE_ADDRESS),
        destinationChainId,
        '0',
        getCctpToStellarHookData(SRB_FINAL_RECIPIENT),
        { value: bridgingFee.add(extraGas) },
      );
      await handleTransactionResult(result);
    } else if (recipientWalletAddressHex) {
      const result = await CctpV2Bridge.bridgeWithWalletAddress(
        totalTokensAmount,
        recipientHex32,
        recipientWalletAddressHex,
        destinationChainId,
        '0',
        { value: bridgingFee.add(extraGas) },
      );
      await handleTransactionResult(result);
    } else {
      const result = await CctpV2Bridge.bridge(
        totalTokensAmount,
        recipientHex32,
        destinationChainId,
        '0',
        { value: bridgingFee.add(extraGas) },
      );
      await handleTransactionResult(result);
    }
  } catch (e) {
    console.error('Error while bridging:', e);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
