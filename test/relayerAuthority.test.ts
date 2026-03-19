import { ethers, waffle } from 'hardhat';
import { expect } from 'chai';
import { addressToBase32, SP } from './utils';
import { parseUnits } from 'ethers/lib/utils';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { abi as GasOracleABI } from '../artifacts/contracts/GasOracle.sol/GasOracle.json';
import { abi as WormholeMessengerABI } from '../artifacts/contracts/WormholeMessenger.sol/WormholeMessenger.json';
import { BigNumber } from 'ethers';

const { deployMockContract } = waffle;

describe('Bridge Relayer Authority', () => {
  const DECIMALS = 6;
  const LIQUIDITY = '3500000';

  async function deployBridgeFixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const BridgeContract = await ethers.getContractFactory('Bridge');
    const TokenContract = await ethers.getContractFactory('Token');
    const PoolContract = await ethers.getContractFactory('Pool');
    const TestMessengerContract = await ethers.getContractFactory('TestMessenger');

    const mockedGasOracle = await deployMockContract(owner, GasOracleABI);
    const mockedWhMessenger = await deployMockContract(owner, WormholeMessengerABI);
    await mockedWhMessenger.mock.receivedMessages.returns(BigNumber.from(0));
    await mockedGasOracle.mock.getTransactionGasCostInNativeToken.returns(10000);

    const testMessenger = await TestMessengerContract.deploy();

    const bridge = (await BridgeContract.deploy(
      1, // chainId
      18, // chainPrecision
      testMessenger.address,
      mockedWhMessenger.address,
      mockedGasOracle.address
    )) as any;

    await bridge.registerBridge(1, addressToBase32(bridge.address));
    await testMessenger.setIsHasMessage(true);

    const tokenA = (await TokenContract.deploy(
      'Token A',
      'A',
      parseUnits('100000000', DECIMALS),
      DECIMALS,
    )) as any;
    const tokenB = (await TokenContract.deploy(
      'Token B',
      'B',
      parseUnits('100000000', DECIMALS),
      DECIMALS,
    )) as any;

    const poolA = (await PoolContract.deploy(
      bridge.address,
      20,
      tokenA.address,
      15,
      2000,
      'aLP',
      'aLP',
    )) as any;
    const poolB = (await PoolContract.deploy(
      bridge.address,
      20,
      tokenB.address,
      15,
      2000,
      'bLP',
      'bLP',
    )) as any;

    await bridge.addPool(poolA.address, addressToBase32(tokenA.address));
    await bridge.addPool(poolB.address, addressToBase32(tokenB.address));

    const liquidity = parseUnits(LIQUIDITY, DECIMALS);
    await tokenA.approve(poolA.address, liquidity);
    await tokenB.approve(poolB.address, liquidity);

    await poolA.deposit(liquidity);
    await poolB.deposit(liquidity);

    return { bridge, tokenA, tokenB, poolA, poolB, owner, relayer: alice, stranger: bob };
  }

  it('Should allow owner to add and remove relayer authority', async () => {
    const { bridge, owner, relayer, stranger } = await loadFixture(deployBridgeFixture);

    expect(await bridge.isRelayerAuthority(relayer.address)).to.eq(false);

    await bridge.connect(owner).addRelayerAuthority(relayer.address);
    expect(await bridge.isRelayerAuthority(relayer.address)).to.eq(true);

    await bridge.connect(owner).removeRelayerAuthority(relayer.address);
    expect(await bridge.isRelayerAuthority(relayer.address)).to.eq(false);

    await expect(bridge.connect(stranger).addRelayerAuthority(relayer.address))
      .to.be.revertedWith('Ownable: caller is not the owner');
  });

  it('Should allow relayer authority to call receiveTokens', async () => {
    const { bridge, relayer, tokenA, stranger } = await loadFixture(deployBridgeFixture);
    const amount = parseUnits('1000', SP);
    const recipient = addressToBase32(stranger.address);
    const sourceChainId = 1;
    const nonce = 1;
    const messenger = 1; // Allbridge

    await bridge.addRelayerAuthority(relayer.address);

    // Should succeed when called by relayer
    await bridge.connect(relayer).receiveTokens(
      amount,
      recipient,
      sourceChainId,
      addressToBase32(tokenA.address),
      nonce,
      messenger,
      0,
    );
  });

  it('Should allow recipient to call receiveTokens', async () => {
    const { bridge, stranger, tokenA } = await loadFixture(deployBridgeFixture);
    const amount = parseUnits('1000', SP);
    const recipient = addressToBase32(stranger.address);
    const sourceChainId = 1;
    const nonce = 1;
    const messenger = 1; // Allbridge

    // Should succeed when called by alice (recipient)
    await bridge.connect(stranger).receiveTokens(
      amount,
      recipient,
      sourceChainId,
      addressToBase32(tokenA.address),
      nonce,
      messenger,
      0,
    );
  });

  it('Should NOT allow stranger to call receiveTokens', async () => {
    const { bridge, stranger, owner} = await loadFixture(deployBridgeFixture);
    const amount = parseUnits('1000', SP);
    const recipient = addressToBase32(owner.address);
    const sourceChainId = 1;
    const nonce = 1;
    const messenger = 1; // Allbridge


    // Should fail when called by stranger
    await expect(bridge.connect(stranger).receiveTokens(
      amount,
      recipient,
      sourceChainId,
      addressToBase32(owner.address),
      nonce,
      messenger,
      0,
    )).to.be.revertedWith('Bridge: not authorized');
  });
});
