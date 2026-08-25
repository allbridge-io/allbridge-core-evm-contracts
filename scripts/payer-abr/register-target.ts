import { ethers } from 'hardhat';
import { getEnv, handleTransactionResult } from '../helper';

const map = new Map<string, [number, string, string]>();
map.set('Allbridge', [1, getEnv('BRIDGE_ADDRESS'), 'swapAndBridge(bytes32,uint256,bytes32,uint256,bytes32,uint256,uint8,uint256)']);
map.set('Wormhole', [2, getEnv('BRIDGE_ADDRESS'), 'swapAndBridge(bytes32,uint256,bytes32,uint256,bytes32,uint256,uint8,uint256)']);
map.set('CCTP', [3, getEnv('CCTP_BRIDGE_ADDRESS'), 'bridge(uint256,bytes32,uint256,uint256)']);
map.set('CCTPv2', [4, getEnv('CCTP_V2_BRIDGE_ADDRESS'), 'bridge(uint256,bytes32,uint256,uint256)']);
map.set('OFT', [5, getEnv('OFT_BRIDGE_ADDRESS'), 'bridge(address,uint256,bytes32,uint256,uint256,uint256,uint256)']);
map.set('CCTP_bridgeWithWalletAddress', [6, getEnv('CCTP_BRIDGE_ADDRESS'), 'bridgeWithWalletAddress(uint256,bytes32,bytes32,uint256,uint256)']);
map.set('CCTPv2_bridgeWithWalletAddress', [7, getEnv('CCTP_V2_BRIDGE_ADDRESS'), 'bridgeWithWalletAddress(uint256,bytes32,bytes32,uint256,uint256)']);
map.set('CCTPv2_bridgeWithHook', [1008, getEnv('CCTP_V2_BRIDGE_ADDRESS'), 'bridgeWithHook(uint256,bytes32,uint256,uint256,bytes)']);

async function main() {
  const contractAddress = getEnv('ABR_PAYER_ADDRESS');
  const contract = await ethers.getContractAt('PayerWithAbr', contractAddress);
  for (const [name, entry] of map) {
    const [messengerProtocol, targetAddress, functionSignature] = entry;
    if (!targetAddress) continue;

    const registeredTarget = await contract.targets(messengerProtocol);
    const expectedSelector = ethers.utils.id(functionSignature).slice(0, 10);
    if (registeredTarget.target.toLowerCase() === targetAddress.toLowerCase() && registeredTarget.selector === expectedSelector) {
      console.log(`Skip target ${name}: already registered`);
      continue;
    }

    console.log(`Register target ${name} with params: protocol ${messengerProtocol}, address ${targetAddress}, function ${functionSignature}`);
    const result = await contract.registerTarget(
      messengerProtocol,
      targetAddress,
      functionSignature,
    );
    await handleTransactionResult(result);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
