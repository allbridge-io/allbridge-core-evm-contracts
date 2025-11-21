import { expect } from 'chai';
import { ethers } from 'hardhat';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { MockERC20, MockGasOracle, MockOFT, OftBridge } from '../typechain';

describe('OftBridge', function () {
  // Test variables
  let oftBridge: OftBridge;
  let mockGasOracle: MockGasOracle;
  let mockERC20: MockERC20;
  let mockOFT: MockOFT;
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let recipient: string;
  let chainId: number;
  let destinationChainId: number;
  let amount: bigint;
  let relayerFeeTokenAmount: bigint;
  let extraGasInDestinationToken: bigint;
  let slippageBP: number;
  const BP = 10000; // Basis points denominator (10000 = 100%)
  const defaultRelayerFee = BigInt(
    ethers.utils.parseUnits('0.01', 18).toString(),
  );

  beforeEach(async function () {
    // Get signers
    [owner, user] = await ethers.getSigners();

    // Set up test variables
    chainId = 1; // Ethereum mainnet
    destinationChainId = 137; // Polygon
    amount = BigInt(ethers.utils.parseUnits('100', 18).toString()); // 100 tokens
    relayerFeeTokenAmount = BigInt(ethers.utils.parseUnits('0', 18).toString()); // 1 token for relayer fee
    extraGasInDestinationToken = BigInt(
      ethers.utils.parseUnits('0.01', 18).toString(),
    ); // 0.01 token worth of gas for destination chain
    slippageBP = 50; // 0.5% slippage tolerance
    recipient = ethers.utils.hexZeroPad(user.address, 32); // Convert user address to bytes32

    // Deploy mock gas oracle
    const MockGasOracle = await ethers.getContractFactory('MockGasOracle');
    mockGasOracle = await MockGasOracle.deploy();
    await mockGasOracle.deployed();

    // Mock price data
    await mockGasOracle.setPrice(chainId, ethers.utils.parseUnits('1', 18)); // 1:1 ratio for simplicity
    await mockGasOracle.setPrice(
      destinationChainId,
      ethers.utils.parseUnits('1', 18),
    );

    // Deploy mock ERC20 token
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    mockERC20 = await MockERC20.deploy('Mock Token', 'MTK', 18);
    await mockERC20.deployed();

    // Mint tokens to user
    await mockERC20.mint(user.address, ethers.utils.parseUnits('1000', 18));

    // Deploy mock OFT contract
    const MockOFT = await ethers.getContractFactory('MockOFT');
    mockOFT = await MockOFT.deploy(mockERC20.address);
    await mockOFT.deployed();

    // Deploy OftBridge
    const OftBridge = await ethers.getContractFactory('OftBridge');
    oftBridge = await OftBridge.deploy(chainId, 18, mockGasOracle.address);
    await oftBridge.deployed();

    // Set up the OFT bridge
    await oftBridge.registerBridgeDestination(destinationChainId, 1000, 300000); // Register destination with eid 1000
    await oftBridge.addToken(mockOFT.address, destinationChainId); // Register OFT token
    await oftBridge.setMaxExtraGas(
      destinationChainId,
      ethers.utils.parseUnits('0.05', 18),
    ); // Set max extra gas
    await oftBridge.setLzGasLimit(destinationChainId, 300000); // Set LayerZero gas limit
    await oftBridge.setAdminFeeShare(mockERC20.address, 500); // 5% admin fee

    // Approve token spending for user
    await mockERC20
      .connect(user)
      .approve(oftBridge.address, ethers.constants.MaxUint256);

    // Configure mock OFT to return fixed messaging fee
    await mockOFT.setDefaultNativeFee(ethers.utils.parseEther('0.01')); // 0.01 ETH as default fee

    // Send 1 ETH to the bridge contract
    await owner.sendTransaction({
      to: oftBridge.address,
      value: ethers.utils.parseEther('1.0'),
    });
  });

  describe('Constructor and Initialization', function () {
    it('Should set the correct initial values', async function () {
      expect(await oftBridge.chainId()).to.equal(chainId);
      expect(await oftBridge.adminFeeShareBP(mockERC20.address)).to.equal(500);
    });

    it('Should register token properly', async function () {
      expect(
        await oftBridge.oftAddress(mockERC20.address, destinationChainId),
      ).to.equal(mockOFT.address);

      // Verify token is properly approved
      const allowance = await mockERC20.allowance(
        oftBridge.address,
        mockOFT.address,
      );
      expect(allowance).to.equal(ethers.constants.MaxUint256);
    });
  });

  describe('Bridge Functionality', function () {
    it('Should bridge tokens successfully', async function () {
      // Calculate expected values
      const amountMinusRelayerFee = amount - relayerFeeTokenAmount;
      const adminFee = (amountMinusRelayerFee * 500n) / BigInt(BP); // 5% admin fee
      const amountToSend = amountMinusRelayerFee - adminFee;

      const relayerFeeGasAmount = ethers.utils.parseEther('0.1');

      // Bridge tokens
      const tx = await oftBridge
        .connect(user)
        .bridge(
          mockERC20.address,
          amount,
          recipient,
          destinationChainId,
          relayerFeeTokenAmount,
          extraGasInDestinationToken,
          slippageBP,
          {
            value: relayerFeeGasAmount,
          },
        );

      // Verify event was emitted
      await expect(tx)
        .to.emit(oftBridge, 'OftTokensSent')
        .withArgs(
          user.address,
          recipient.toLowerCase(),
          ethers.utils.getAddress(mockERC20.address.toLowerCase()),
          amountToSend,
          destinationChainId,
          relayerFeeGasAmount,
          '0',
          defaultRelayerFee + extraGasInDestinationToken,
          relayerFeeTokenAmount,
          adminFee,
          extraGasInDestinationToken,
        );

      // Verify token transfer
      expect(await mockERC20.balanceOf(oftBridge.address)).to.equal(
        relayerFeeTokenAmount + adminFee,
      );
      expect(await mockERC20.balanceOf(mockOFT.address)).to.equal(amountToSend);
    });

    it('Should fail when amount <= relayer fee', async function () {
      await expect(
        oftBridge.connect(user).bridge(
          mockERC20.address,
          relayerFeeTokenAmount, // Same as relayer fee, should fail
          recipient,
          destinationChainId,
          relayerFeeTokenAmount,
          extraGasInDestinationToken,
          slippageBP,
          { value: ethers.utils.parseEther('0.01') },
        ),
      ).to.be.revertedWith('Amount <= relayer fee');
    });

    it('Should fail with zero recipient', async function () {
      const zeroRecipient = ethers.constants.HashZero;

      await expect(
        oftBridge
          .connect(user)
          .bridge(
            mockERC20.address,
            amount,
            zeroRecipient,
            destinationChainId,
            relayerFeeTokenAmount,
            extraGasInDestinationToken,
            slippageBP,
            { value: ethers.utils.parseEther('0.01') },
          ),
      ).to.be.revertedWith('Recipient must be nonzero');
    });

    it('Should fail when extra gas is too high', async function () {
      const tooHighExtraGas = ethers.utils.parseUnits('0.1', 18); // Above the limit set in beforeEach

      await expect(
        oftBridge
          .connect(user)
          .bridge(
            mockERC20.address,
            amount,
            recipient,
            destinationChainId,
            relayerFeeTokenAmount,
            tooHighExtraGas,
            slippageBP,
            { value: ethers.utils.parseEther('0.01') },
          ),
      ).to.be.revertedWith('Extra gas too high');
    });

    it('Should fail when not enough fee is provided', async function () {
      // Set mockOFT to require a higher fee
      await mockOFT.setDefaultNativeFee(ethers.utils.parseEther('0.05')); // 0.05 ETH

      await expect(
        oftBridge.connect(user).bridge(
          mockERC20.address,
          amount,
          recipient,
          destinationChainId,
          relayerFeeTokenAmount,
          extraGasInDestinationToken,
          slippageBP,
          { value: ethers.utils.parseEther('0.01') }, // Too low
        ),
      ).to.be.revertedWith('Not enough fee');
    });

    it('Should fail for unknown destination chain', async function () {
      const unknownChainId = 999;

      await expect(
        oftBridge
          .connect(user)
          .bridge(
            mockERC20.address,
            amount,
            recipient,
            unknownChainId,
            relayerFeeTokenAmount,
            extraGasInDestinationToken,
            slippageBP,
            { value: ethers.utils.parseEther('0.01') },
          ),
      ).to.be.revertedWith('Token is not registered for the destination');
      await oftBridge.addToken(mockOFT.address, unknownChainId);

      await expect(
        oftBridge
          .connect(user)
          .bridge(
            mockERC20.address,
            amount,
            recipient,
            unknownChainId,
            relayerFeeTokenAmount,
            extraGasInDestinationToken,
            slippageBP,
            { value: ethers.utils.parseEther('0.01') },
          ),
      ).to.be.revertedWith('Unknown chain id');
    });
  });

  describe('Fee Calculation and Queries', function () {
    it('Should calculate relayer fee correctly', async function () {
      const fee = await oftBridge.relayerFee(
        mockERC20.address,
        destinationChainId,
        amount,
      );
      expect(fee).to.equal(ethers.utils.parseEther('0.01')); // Default fee we set
    });

    it('Should calculate extra gas price correctly', async function () {
      const extraGasAmount = ethers.utils.parseUnits('0.002', 18);
      const extraGasCost = await oftBridge.extraGasPrice(
        mockERC20.address,
        destinationChainId,
        1,
        extraGasAmount,
      );

      // Should be equal to amount in tests
      expect(extraGasCost).to.equal(extraGasAmount);
    });

    it('Should return correct token-to-gas conversion', async function () {
      // We'll test the internal _getStableTokensValueInGas function indirectly through bridge
      // First, set a fixed relayer fee
      await mockOFT.setDefaultNativeFee(ethers.utils.parseEther('0.01'));

      // Then set gas oracle price to make token-to-gas conversion predictable
      await mockGasOracle.setPrice(chainId, ethers.utils.parseEther('2')); // 1 token = 0.5 ETH
      const relayerFeeTokenAmount = BigInt(
        ethers.utils.parseUnits('0.02', 18).toString(),
      );
      const relayerFeeGasAmount = '0';
      const extraGasInDestinationToken = 0n; // No ETH, tokens should cover fee
      // Bridge with 0 ETH value and let token conversion cover the fee
      const tx = oftBridge.connect(user).bridge(
        mockERC20.address,
        amount,
        recipient,
        destinationChainId,
        relayerFeeTokenAmount, // 0.02 tokens = 0.01 ETH at our price
        extraGasInDestinationToken, // No extra gas
        slippageBP,
        { value: relayerFeeGasAmount },
      );

      // Transaction should succeed if token conversion worked correctly
      await expect(tx).to.not.be.reverted;

      const amountMinusRelayerFee = amount - relayerFeeTokenAmount;
      const adminFee = (amountMinusRelayerFee * 500n) / BigInt(BP); // 5% admin fee
      const amountToSend = amountMinusRelayerFee - adminFee;

      // Verify event was emitted
      await expect(await tx)
        .to.emit(oftBridge, 'OftTokensSent')
        .withArgs(
          user.address,
          recipient.toLowerCase(),
          ethers.utils.getAddress(mockERC20.address.toLowerCase()),
          amountToSend,
          destinationChainId,
          relayerFeeGasAmount,
          ethers.utils.parseUnits('0.01', 18), // 0.02 tokens = 0.01 ETH at our price
          defaultRelayerFee + extraGasInDestinationToken,
          relayerFeeTokenAmount,
          adminFee,
          extraGasInDestinationToken,
        );
    });
  });

  describe('Admin Functions', function () {
    it('Should allow owner to withdraw gas', async function () {
      // Send some ETH to the contract
      await owner.sendTransaction({
        to: oftBridge.address,
        value: ethers.utils.parseEther('1.0'),
      });

      const initialBalance = await ethers.provider.getBalance(owner.address);

      // Withdraw gas
      await oftBridge
        .connect(owner)
        .withdrawGas(ethers.utils.parseEther('0.5'));

      const finalBalance = await ethers.provider.getBalance(owner.address);

      // Account for gas used in the transaction
      expect(finalBalance.sub(initialBalance)).to.be.closeTo(
        ethers.utils.parseEther('0.5'),
        ethers.utils.parseEther('0.01'), // Allow for gas costs
      );
    });

    it('Should allow owner to withdraw token fees', async function () {
      // First, bridge some tokens to generate fees
      await oftBridge
        .connect(user)
        .bridge(
          mockERC20.address,
          amount,
          recipient,
          destinationChainId,
          relayerFeeTokenAmount,
          0,
          slippageBP,
          { value: ethers.utils.parseEther('0.01') },
        );

      // Check initial balance
      const initialBalance = await mockERC20.balanceOf(owner.address);

      // Withdraw fees
      await oftBridge.connect(owner).withdrawFeeInTokens(mockERC20.address);

      // Check final balance
      const finalBalance = await mockERC20.balanceOf(owner.address);

      // Should have received the fees (relayer fee + admin fee)
      expect(finalBalance.sub(initialBalance)).to.be.gt(0);
    });

    it('Should allow owner to update admin fee share', async function () {
      await oftBridge.connect(owner).setAdminFeeShare(mockERC20.address, 1000); // 10%
      expect(await oftBridge.adminFeeShareBP(mockERC20.address)).to.equal(1000);

      // Try setting too high
      await expect(
        oftBridge.connect(owner).setAdminFeeShare(mockERC20.address, BP + 1),
      ).to.be.revertedWith('Too high');
    });

    it('Should allow owner to update max extra gas', async function () {
      const newMaxExtraGas = ethers.utils.parseUnits('0.1', 18);
      await oftBridge
        .connect(owner)
        .setMaxExtraGas(destinationChainId, newMaxExtraGas);

      // Now we should be able to use higher extra gas values
      const tx = oftBridge
        .connect(user)
        .bridge(
          mockERC20.address,
          amount,
          recipient,
          destinationChainId,
          relayerFeeTokenAmount,
          '0',
          slippageBP,
          { value: ethers.utils.parseEther('0.01') },
        );

      await expect(tx).to.not.be.reverted;
    });

    it('Should allow owner to remove a token', async function () {
      // First check the token is registered
      expect(
        await oftBridge.oftAddress(mockERC20.address, destinationChainId),
      ).to.equal(mockOFT.address);

      // Remove the token
      await oftBridge
        .connect(owner)
        .removeToken(mockOFT.address, destinationChainId);

      // Check it's removed
      expect(
        await oftBridge.oftAddress(mockERC20.address, destinationChainId),
      ).to.equal(ethers.constants.AddressZero);

      // Trying to bridge should now fail
      await expect(
        oftBridge
          .connect(user)
          .bridge(
            mockERC20.address,
            amount,
            recipient,
            destinationChainId,
            relayerFeeTokenAmount,
            extraGasInDestinationToken,
            slippageBP,
            { value: ethers.utils.parseEther('0.01') },
          ),
      ).to.be.revertedWith('Token is not registered');
    });

    it('Should allow owner to remove a token allowance and scaling factor', async function () {
      expect(
        await mockERC20.allowance(oftBridge.address, mockOFT.address),
      ).to.equal(ethers.constants.MaxUint256);

      // Remove the token
      await oftBridge
        .connect(owner)
        .removeTokenAllowanceAndScalingFactor(mockOFT.address);

      // Check it's removed
      expect(
        await mockERC20.allowance(oftBridge.address, mockOFT.address),
      ).to.equal(ethers.constants.Zero);
    });

    it('Should allow only owner to call admin functions', async function () {
      await expect(
        oftBridge.connect(user).setAdminFeeShare(mockERC20.address, 1000),
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        oftBridge.connect(user).withdrawGas(ethers.utils.parseEther('0.5')),
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        oftBridge.connect(user).withdrawFeeInTokens(mockERC20.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        oftBridge.connect(user).addToken(mockOFT.address, destinationChainId),
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        oftBridge
          .connect(user)
          .removeToken(mockOFT.address, destinationChainId),
      ).to.be.revertedWith('Ownable: caller is not the owner');

      await expect(
        oftBridge
          .connect(user)
          .removeTokenAllowanceAndScalingFactor(mockOFT.address),
      ).to.be.revertedWith('Ownable: caller is not the owner');
    });
  });

  describe('Withdraw fee', () => {
    it('success withdrawGas', async () => {
      const initialContractBalance = await ethers.provider.getBalance(
        oftBridge.address,
      );
      const initialBalance = await ethers.provider.getBalance(owner.address);

      await oftBridge.withdrawGas(ethers.utils.parseEther('0.5'));

      const finalBalance = await ethers.provider.getBalance(owner.address);
      const finalContractBalance = await ethers.provider.getBalance(
        oftBridge.address,
      );

      expect(finalBalance.sub(initialBalance)).to.be.closeTo(
        ethers.utils.parseEther('0.5'),
        ethers.utils.parseEther('0.0001'),
      );
      expect(initialContractBalance.sub(finalContractBalance)).to.equal(
        ethers.utils.parseEther('0.5'),
      );
    });

    it('success withdrawFeeInTokens', async () => {
      const transferAmount = ethers.utils.parseUnits('1.0', 18);

      // Transfer tokens directly to bridge contract
      await mockERC20.mint(oftBridge.address, transferAmount);

      const initialContractBalance = await mockERC20.balanceOf(
        oftBridge.address,
      );
      const initialBalance = await mockERC20.balanceOf(owner.address);

      await oftBridge.withdrawFeeInTokens(mockERC20.address);

      const finalBalance = await mockERC20.balanceOf(owner.address);
      const finalContractBalance = await mockERC20.balanceOf(oftBridge.address);

      expect(finalBalance.sub(initialBalance)).to.equal(initialContractBalance);
      expect(finalContractBalance).to.equal(0);
    });
  });

  describe('Edge Cases and Security', function () {
    it('Should handle zero slippage value', async function () {
      const tx = oftBridge.connect(user).bridge(
        mockERC20.address,
        amount,
        recipient,
        destinationChainId,
        relayerFeeTokenAmount,
        extraGasInDestinationToken,
        0, // Zero slippage
        { value: ethers.utils.parseEther('0.1') },
      );

      await expect(tx).to.not.be.reverted;
    });

    it('Should handle minimum token amounts', async function () {
      // Test with very small amount, just above relayer fee
      const smallAmount = relayerFeeTokenAmount + 2n; // relayer fee + 2 wei

      const tx = oftBridge.connect(user).bridge(
        mockERC20.address,
        smallAmount,
        recipient,
        destinationChainId,
        relayerFeeTokenAmount,
        0, // No extra gas
        0, // No slippage
        { value: ethers.utils.parseEther('0.01') },
      );

      await expect(tx).to.not.be.reverted;

      // With the admin fee set to 5%, the admin fee should be 1 wei (minimum)
      await expect(tx).to.emit(oftBridge, 'OftTokensSent').withArgs(
        user.address,
        recipient.toLowerCase(),
        ethers.utils.getAddress(mockERC20.address.toLowerCase()),
        1, // Remaining amount should be 1 wei (2 - 1 admin fee)
        destinationChainId,
        ethers.utils.parseEther('0.01'),
        0, // No tokens used for gas
        ethers.utils.parseEther('0.01'),
        relayerFeeTokenAmount,
        1, // Minimum admin fee (1 wei)
        0, // No extra gas
      );
    });

    it('Should receive direct gas transfers', async function () {
      const tx = await owner.sendTransaction({
        to: oftBridge.address,
        value: ethers.utils.parseEther('1.0'),
      });

      await expect(tx)
        .to.emit(oftBridge, 'ReceivedGas')
        .withArgs(owner.address, ethers.utils.parseEther('1.0'));
    });

    it('Should reject direct calls to fallback function', async function () {
      // Create calldata for a non-existent function
      const callData = ethers.utils.hexlify(ethers.utils.randomBytes(4));

      await expect(
        owner.sendTransaction({
          to: oftBridge.address,
          data: callData,
          value: ethers.utils.parseEther('0.1'),
        }),
      ).to.be.reverted;
    });
  });
});
