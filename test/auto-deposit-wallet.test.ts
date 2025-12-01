import { ethers } from 'hardhat';
import { expect } from 'chai';
import { AutoDepositFactory, AutoDepositWallet, GasOracle, MockBridge, Token } from '../typechain';
import { parseUnits } from 'ethers/lib/utils';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { addressToBytes32 } from '../scripts/helper';

const CHAIN_1 = 1;
const OTHER_CHAIN_ID = 2;
const ORACLE_PRECISION = 18;

describe('AutoDepositWallet', () => {
  let fabric: AutoDepositFactory;
  let wallet: AutoDepositWallet;
  let gasOracle: GasOracle;
  let tokenA: Token;
  let tokenB: Token;
  let bridge: MockBridge;
  let deployer: SignerWithAddress;
  let alice: SignerWithAddress;
  const chainPrecision = 18;
  const tokenADecimals = 6;
  const tokenBDecimals = 18;

  let recipientChainId: number;
  let bridgeAddress: string;
  let recipientAddressBytes: string;
  let recipientTokenAddressBytes: string;
  let minDepositTokens: string;

  async function setupContractsFixture() {
    [deployer, alice] = await ethers.getSigners();

    const tokenContractFactory = await ethers.getContractFactory('Token');
    const fabricFactory = (await ethers.getContractFactory(
      'AutoDepositFactory',
    )) as any;
    const gasOracleFactory = (await ethers.getContractFactory(
      'GasOracle',
    )) as any;
    const mockBridgeFactory = (await ethers.getContractFactory(
      'MockBridge',
    )) as any;

    gasOracle = await gasOracleFactory.deploy(CHAIN_1, chainPrecision);
    bridge = await mockBridgeFactory.deploy();

    tokenA = (await tokenContractFactory.deploy(
      'A',
      'A',
      parseUnits('100000000000000000000', tokenADecimals),
      tokenADecimals,
    )) as any;

    tokenB = (await tokenContractFactory.deploy(
      'B',
      'B',
      parseUnits('100000000000000000000', tokenBDecimals),
      tokenBDecimals,
    )) as any;

    fabric = await fabricFactory.deploy(
      CHAIN_1,
      chainPrecision,
      gasOracle.address,
      0xff
    );

    console.log('Contracts deployed');

    await bridge.addPool(
      '0x5B02587a69dac7AFBC34eFa23982e95BCed3138c',
      addressToBytes32(tokenA.address),
    );

    await fabric.registerToken(tokenA.address);
    await fabric.registerToken(tokenB.address);

    await gasOracle.setChainData(
      CHAIN_1,
      parseUnits('4000', ORACLE_PRECISION),
      '0',
    );

    await tokenA.transfer(alice.address, parseUnits('1000', tokenADecimals));
    await tokenB.transfer(alice.address, parseUnits('1000', tokenBDecimals));
    console.log('Contracts set up');
  }

  async function initializeWallet(
    params?: Partial<{
      recipientChainId: number;
      bridgeAddress: string;
      recipientAddress: string;
      recipientTokenAddress: string;
      minDepositTokens: string;
    }>,
  ) {
    recipientChainId = params?.recipientChainId ?? OTHER_CHAIN_ID;
    bridgeAddress = params?.bridgeAddress ?? bridge.address;
    recipientAddressBytes = addressToBytes32(
      params?.recipientAddress ?? alice.address,
    );
    recipientTokenAddressBytes = addressToBytes32(
      params?.recipientTokenAddress ??
      '0xF052839B48eE462fedC250F5CEF8263DD569228b',
    );
    minDepositTokens = params?.minDepositTokens ?? '100';

    const response = await fabric.deployDepositWallet(
      recipientChainId,
      bridgeAddress,
      recipientAddressBytes,
      recipientTokenAddressBytes,
      minDepositTokens,
    );
    const receipt = await response.wait();

    const args = receipt.events?.find(
      (ev) => ev.event === 'AutoDepositWalletDeployedEvent',
    )?.args;
    const walletAddress = args?.wallet;
    wallet = await ethers.getContractAt('AutoDepositWallet', walletAddress);
  }

  beforeEach(async () => {
    await loadFixture(setupContractsFixture);
  });

  describe('initialize', () => {
    it('Success: initialize set expected params', async () => {
      await initializeWallet();

      expect(await wallet.factory()).to.eq(fabric.address);
      expect(await wallet.bridge()).to.eq(bridge.address);
      expect(await wallet.recipientChainId()).to.eq(recipientChainId);
      expect(await wallet.recipient()).to.eq(recipientAddressBytes);
      expect(await wallet.recipientToken()).to.eq(recipientTokenAddressBytes);
    });

    it('Failure: initialize should fail when minDepositAmount is zero', async () => {
      await expect(
        initializeWallet({
          recipientChainId: OTHER_CHAIN_ID,
          bridgeAddress: bridge.address,
          recipientAddress: '0x6953Cc76152EEd73190C36Dc2681cFEB141f3E6e',
          recipientTokenAddress: '0xF052839B48eE462fedC250F5CEF8263DD569228b',
          minDepositTokens: '0',
        }),
      ).to.be.revertedWith('ADW: minDepositAmount is not set');
    });
  });

  describe('swapAndBridge', () => {
    const bridgingCostInTokens = 10000;
    const nonce = '123';
    const messengerProtocol = 1;
    let amount: string;

    beforeEach(async () => {
      amount = parseUnits('100', tokenADecimals).toString();
      await tokenA.transfer(wallet.address, amount);
    });

    it('Success: swapAndBridge should call bridge', async () => {
      await initializeWallet();
      await wallet.registerToken(tokenA.address);

      const expectedFeeAmount = bridgingCostInTokens + 1;

      const response = await wallet.swapAndBridge(
        tokenA.address,
        nonce,
        messengerProtocol,
      );

      console.log(await response.wait());

      await expect(response)
        .to.emit(bridge, 'SwapAndBridgeEvent')
        .withArgs(
          addressToBytes32(tokenA.address),
          amount,
          recipientAddressBytes,
          recipientChainId,
          recipientTokenAddressBytes,
          nonce,
          messengerProtocol,
          expectedFeeAmount,
          '0',
        );
    });

    it('Success: swapAndBridge should approve new token before bridge', async () => {
      await initializeWallet();

      const expectedFeeAmount = bridgingCostInTokens + 1;

      const response = await wallet.swapAndBridge(
        tokenA.address,
        nonce,
        messengerProtocol,
      );

      expect(await tokenA.allowance(wallet.address, bridgeAddress)).to.eq(
        ethers.constants.MaxUint256,
      );

      await expect(response)
        .to.emit(bridge, 'SwapAndBridgeEvent')
        .withArgs(
          addressToBytes32(tokenA.address),
          amount,
          recipientAddressBytes,
          recipientChainId,
          recipientTokenAddressBytes,
          nonce,
          messengerProtocol,
          expectedFeeAmount,
          '0',
        );
    });

    it('Failure: swapAndBridge should fail when amount is less than minDepositTokens', async () => {
      await initializeWallet({
        minDepositTokens: '1000',
      });

      await expect(
        wallet.swapAndBridge(tokenA.address, nonce, messengerProtocol),
      ).to.be.revertedWith('ADW: amount too low');
    });
  });


  describe('Admin methods', () => {
    describe('transferUnsupportedToken', () => {
      let supportedToken: Token;
      let unsupportedToken: Token;
      let amountUnsupportedToken: string;

      beforeEach(async () => {
        supportedToken = tokenA;
        unsupportedToken = tokenB;
        await initializeWallet();
        const amountSupportedToken = parseUnits(
          '100',
          tokenADecimals,
        ).toString();
        amountUnsupportedToken = parseUnits('100', tokenBDecimals).toString();
        await supportedToken.transfer(wallet.address, amountSupportedToken);
        await unsupportedToken.transfer(wallet.address, amountUnsupportedToken);
      });

      it('Success: should withdraw unsupported tokens', async () => {
        const response = await wallet.transferUnsupportedToken(
          unsupportedToken.address,
          alice.address,
        );
        expect(response).to.changeTokenBalances(
          unsupportedToken,
          [wallet, alice],
          ['-' + amountUnsupportedToken, amountUnsupportedToken],
        );
      });

      it('Failure: should revert when token can be bridged', async () => {
        await expect(
          wallet.transferUnsupportedToken(
            supportedToken.address,
            alice.address,
          ),
        ).revertedWith('ADW: bridging is supported');
      });

      it('Failure: should revert when the caller is not the factory owner', async () => {
        await expect(
          wallet
            .connect(alice)
            .transferUnsupportedToken(unsupportedToken.address, alice.address),
        ).revertedWith('ADW: caller is not the factory owner');
      });
    });

    describe('factorySwapAndBridge', () => {
      beforeEach(async () => {
        await initializeWallet();
      })

      it('Failure: should revert when the caller is not the factory', async () => {
        await expect(
          wallet
            // .connect(alice)
            .factorySwapAndBridge(tokenA.address,
              parseUnits('100'),
              1234,
              1),
        ).revertedWith('ADW: caller is not the factory');
      });
    });
  });

  it('Failure: send gas tokens should fail', async () => {
    await initializeWallet();

    await expect(
      deployer.sendTransaction({
        to: wallet.address,
        value: ethers.utils.parseEther('0.1'),
      }),
    ).to.be.reverted;
  });
});
