// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SendParam, IOFT, MessagingFee} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

/**
 * @title OftBridge
 * @notice A proxy contract for handling cross-chain token transfers using LayerZero's Omnichain Fungible Token (OFT) standard.
 * @dev Incorporates OpenZeppelin and LayerZero libraries for safe token handling and cross-chain messaging.
 */
contract OftBridge is Ownable {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    // Constants
    uint internal constant ORACLE_PRECISION = 18; // Decimals for gas cost calculations
    uint internal constant BP = 1e4;             // Basis points denominator (1 basis point = 0.01%)
    uint private immutable chainPrecision;       // Current chain precision

    // State variables
    IGasOracle internal gasOracle;               // Gas price oracle for pricing gas in token terms
    uint public immutable chainId;               // Chain ID of the current blockchain
    mapping(address tokenAddress => uint feeShare) public adminFeeShareBP;    // Admin's fee share per token (bps)

    // Mappings for managing token addresses and chain configurations
    mapping(address tokenAddress => uint scalingFactor) internal stableTokensForGasScalingFactor; // Scaling factor for token-to-gas conversion
    mapping(uint chainId => uint32 eid) private chainIdEidMap;                               // Map from chain ID to LayerZero Endpoint ID
    mapping(uint chainId => uint maxExtraGas) internal maxExtraGas;                         // Maximum allowed extra gas for each chain
    mapping(uint chainId => uint128 gasLimit) internal lzGasLimit;                          // LayerZero-specific gas limit for cross-chain transactions
    mapping(address tokenAddress => address oftAddress) public oftAddress;                 // Map from token to its OFT contract address

    /**
     * @dev Event emitted when the contract receives some gas directly.
     * @param sender The address of the sender.
     * @param amount The amount of gas received.
     */
    event ReceivedGas(address sender, uint amount);

    /**
     * @dev Event emitted when tokens are sent to a destination chain.
     */
    event OftTokensSent(
        address sender,
        bytes32 recipient,
        address tokenAddress,
        uint amount,
        uint destinationChainId,
        uint receivedRelayerFeeFromGas,
        uint receivedRelayerFeeFromTokens,
        uint relayerFeeWithExtraGas,
        uint receivedRelayerFeeTokenAmount,
        uint adminFeeTokenAmount,
        uint extraGasDestinationToken
    );

    /**
     * @notice Constructor to initialize the OftBridge.
     * @param chainId_ The chain ID of the current blockchain.
     * @param gasOracle_ The address of the gas oracle contract.
     */
    constructor(
        uint chainId_,
        uint chainPrecision_,
        IGasOracle gasOracle_
    ) {
        chainId = chainId_;
        gasOracle = gasOracle_;
        chainPrecision = chainPrecision_;
    }

    /**
     * @notice Bridges tokens to a destination chain.
     * @param tokenAddress The token address to send.
     * @param amount The amount of tokens to bridge.
     * @param recipient The recipient address on the destination chain (as bytes32).
     * @param destinationChainId The ID of the destination chain.
     * @param relayerFeeTokenAmount The portion of the fee in tokens.
     * @param extraGasInDestinationToken Additional gas for execution on the destination chain.
     * @param slippageBP The acceptable slippage in basis points.
     */
    function bridge(
        address tokenAddress,
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        uint relayerFeeTokenAmount,
        uint extraGasInDestinationToken,
        uint slippageBP
    ) public payable {
        // Validate input parameters
        require(amount > relayerFeeTokenAmount, "Amount <= relayer fee");
        require(recipient != 0, "Recipient must be nonzero");
        require(slippageBP <= BP, "Too high slippage");
        // Retrieve the oft address associated with the token
        address oft = oftAddress[tokenAddress];
        require(oft != address(0), "Token is not registered");

        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        // Ensure extra gas is within the allowed limit
        require(maxExtraGas[destinationChainId] == 0 || extraGasInDestinationToken <= maxExtraGas[destinationChainId], "Extra gas too high");

        // Initialize LayerZero options for the transaction
        bytes memory options = OptionsBuilder.newOptions();
        if (lzGasLimit[destinationChainId] > 0) {
            options = options.addExecutorLzReceiveOption(lzGasLimit[destinationChainId], 0);
        }
        if (extraGasInDestinationToken > 0) {
            options = options.addExecutorNativeDropOption(uint128(extraGasInDestinationToken), recipient);
        }

        // Calculate the amount to send after deducting fees
        uint amountToSend = amount - relayerFeeTokenAmount;
        uint adminFee;
        if (adminFeeShareBP[tokenAddress] != 0) {
            adminFee = (amountToSend * adminFeeShareBP[tokenAddress]) / BP;
            if (adminFee == 0) {
                adminFee = 1;
            }
            amountToSend -= adminFee;
        }

        // Prepare the LayerZero `SendParam` with messaging options and slippage
        SendParam memory sendParam = SendParam(
            getEidByChainId(destinationChainId),
            recipient,
            amountToSend,
            amountToSend - (amountToSend * slippageBP / BP), // Minimum amount (after slippage)
            options,
            "",
            ""
        );

        // Retrieve the messaging fee from the LayerZero protocol
        MessagingFee memory messagingFee = IOFT(oft).quoteSend(sendParam, false);

        // Calculate the gas equivalent of stable tokens for the relayer fee
        uint gasFromStables = _getStableTokensValueInGas(tokenAddress, relayerFeeTokenAmount);
        require(msg.value + gasFromStables >= messagingFee.nativeFee, "Not enough fee");

        // Send the transaction through the OFT protocol
        require(address(this).balance >= messagingFee.nativeFee, "Insufficient contract balance");
        IOFT(oft).send{value: messagingFee.nativeFee}(sendParam, messagingFee, msg.sender);

        // Emit an event for tracking the token bridge
        emit OftTokensSent(
            msg.sender,
            recipient,
            tokenAddress,
            amountToSend,
            destinationChainId,
            msg.value,
            gasFromStables,
            messagingFee.nativeFee,
            relayerFeeTokenAmount,
            adminFee,
            extraGasInDestinationToken
        );
    }

    /**
    * @notice Registers a new destination chain for bridging operations.
     * @param chainId_ The chain ID of the destination chain.
     * @param eid_ The LayerZero endpoint ID for the destination chain.
     * @param lzGasLimit_ The gas limit for LayerZero operations on the destination chain.
     */
    function registerBridgeDestination(uint chainId_, uint32 eid_, uint128 lzGasLimit_) external onlyOwner {
        chainIdEidMap[chainId_] = eid_;
        lzGasLimit[chainId_] = lzGasLimit_;
    }

    /**
     * @notice Allows the admin to remove a chain from the map of supported destinations.
     * @param chainId_ The chain ID of the destination to unregister.
     */
    function unregisterBridgeDestination(uint chainId_) external onlyOwner {
        chainIdEidMap[chainId_] = 0;
        lzGasLimit[chainId_] = 0;
    }

    /**
     * @notice Adds a new token to the bridge with its corresponding OFT contract.
     * @param oft_ The address of the OFT contract for the token.
     */
    function addToken(address oft_) external onlyOwner {
        address tokenAddress = IOFT(oft_).token();
        uint tokenDecimals = IERC20Metadata(tokenAddress).decimals();
        if (oft_ != tokenAddress) {
            IERC20(tokenAddress).approve(oft_, type(uint256).max);
        }
        stableTokensForGasScalingFactor[tokenAddress] = 10 ** (ORACLE_PRECISION - tokenDecimals + chainPrecision);
        oftAddress[tokenAddress] = oft_;
    }

    /**
     * @notice Removes a token from the bridge.
     * @param oft_ The address of the OFT contract to remove.
     */
    function removeToken(address oft_) external onlyOwner {
        address tokenAddress = IOFT(oft_).token();
        stableTokensForGasScalingFactor[tokenAddress] = 0;
        if (oft_ != tokenAddress) {
            IERC20(tokenAddress).approve(oft_, 0);
        }
        oftAddress[tokenAddress] = address(0);
    }

    /**
     * @notice Retrieves the relayer fee required for a specific chain.
     * @param tokenAddress_ The address of the token.
     * @param destinationChainId_ The ID of the destination chain.
     * @return The required fee in native gas tokens.
     */
    function relayerFee(address tokenAddress_, uint destinationChainId_) external view returns (uint) {
        address oft = oftAddress[tokenAddress_];
        require(oft != address(0), "Token is not registered");
        MessagingFee memory messagingFee = IOFT(oft).quoteSend(_createEmptySendParam(destinationChainId_, 0), false);
        return messagingFee.nativeFee;
    }

    /**
     * @notice Calculates the price of additional gas on the destination chain.
     * @param tokenAddress_ The address of the token.
     * @param destinationChainId_ The ID of the destination chain.
     * @param extraGasAmount_ The extra gas amount for the destination chain.
     * @return The price of the additional gas in native tokens.
     */
    function extraGasPrice(address tokenAddress_, uint destinationChainId_, uint128 extraGasAmount_) external view returns (uint) {
        address oft = oftAddress[tokenAddress_];
        require(oft != address(0), "Token is not registered");
        MessagingFee memory messagingFee1 = IOFT(oft).quoteSend(_createEmptySendParam(destinationChainId_, extraGasAmount_), false);
        MessagingFee memory messagingFee2 = IOFT(oft).quoteSend(_createEmptySendParam(destinationChainId_, extraGasAmount_ * 2), false);
        return messagingFee2.nativeFee - messagingFee1.nativeFee;
    }

    /**
     * @notice Allows the admin to withdraw the relayer fee collected in gas tokens.
     * @param amount_ The amount of gas tokens to withdraw.
     * @dev Only callable by the contract owner. Transfers the specified amount of native tokens
     * from the contract to the owner's address.
     */
    function withdrawGas(uint amount_) external onlyOwner {
        payable(msg.sender).transfer(amount_);
    }

    /**
     * @notice Allows the admin to withdraw the admin fee and relayer fee collected in tokens.
     * @param token_ The ERC20 token contract address from which to withdraw fees.
     * @dev Only callable by the contract owner. Transfers all available tokens
     * of the specified type from the contract to the owner's address.
     */
    function withdrawFeeInTokens(IERC20 token_) external onlyOwner {
        uint toWithdraw = token_.balanceOf(address(this));
        if (toWithdraw > 0) {
            token_.safeTransfer(msg.sender, toWithdraw);
        }
    }

    /**
     * @notice Sets the basis points of the admin fee share from each bridge.
     * @param tokenAddress_ The address of the token for which to set the admin fee share.
     * @param adminFeeShareBP_ The percentage of the fee in basis points (1 BP = 0.01%) to be allocated to admin.
     * @dev Only callable by the contract owner.
     * The value must be less than or equal to the BP constant (10000).
     * This fee is deducted from the token amount before bridging.
     */
    function setAdminFeeShare(address tokenAddress_, uint adminFeeShareBP_) external onlyOwner {
        require(adminFeeShareBP_ <= BP, "Too high");
        adminFeeShareBP[tokenAddress_] = adminFeeShareBP_;
    }

    /**
     * @notice Sets the maximum extra gas allowed for a specific chain.
     * @param chainId_ The chain ID to set the limit for.
     * @param maxExtraGas_ The maximum amount of extra gas allowed.
     */
    function setMaxExtraGas(uint chainId_, uint maxExtraGas_) external onlyOwner {
        maxExtraGas[chainId_] = maxExtraGas_;
    }

    /**
     * @notice Sets the LayerZero gas limit for a specific chain.
     * @param chainId_ The chain ID to set the limit for.
     * @param lzGasLimit_ The gas limit for LayerZero operations.
     */
    function setLzGasLimit(uint chainId_, uint128 lzGasLimit_) external onlyOwner {
        lzGasLimit[chainId_] = lzGasLimit_;
    }

    /**
     * @notice Gets the LayerZero endpoint ID for a given chain ID.
     * @param chainId_ The chain ID to lookup.
     * @return The corresponding LayerZero endpoint ID.
     */
    function getEidByChainId(uint chainId_) public view returns (uint32) {
        uint32 domainNumber = chainIdEidMap[chainId_];
        require(domainNumber > 0, "Unknown chain id");
        return domainNumber;
    }

    /**
     * @notice Creates an empty SendParam structure for fee estimation.
     * @dev Used internally to create a basic SendParam with minimal values for gas calculations.
     * @param destinationChainId_ The ID of the destination chain.
     * @param extraGasDestinationToken_ Additional gas amount for the destination chain execution.
     * @return SendParam A LayerZero SendParam structure with basic configuration.
     */
    function _createEmptySendParam(
        uint destinationChainId_, uint128 extraGasDestinationToken_
    ) private view returns (SendParam memory) {
        bytes memory options = OptionsBuilder.newOptions();
        if (lzGasLimit[destinationChainId_] > 0) {
            options = options.addExecutorLzReceiveOption(lzGasLimit[destinationChainId_], 0);
        }
        if (extraGasDestinationToken_ > 0) {
            options = options.addExecutorNativeDropOption(extraGasDestinationToken_, bytes32(0));
        }
        return SendParam(
            getEidByChainId(destinationChainId_),
            bytes32(0),
            0,
            0,
            options,
            "",
            ""
        );
    }

    /**
     * @notice Calculates the amount of gas equivalent in value to provided amount of tokens
     * according to the current exchange rate.
     * @param tokenAddress_ The address of the token.
     * @param stableTokenAmount_ The amount of tokens.
     * @return amount of gas tokens.
     */
    function _getStableTokensValueInGas(address tokenAddress_, uint stableTokenAmount_) internal view returns (uint) {
        require(stableTokensForGasScalingFactor[tokenAddress_] > 0, "Token is not set");
        if (stableTokenAmount_ == 0) return 0;
        return (stableTokensForGasScalingFactor[tokenAddress_] * stableTokenAmount_) / gasOracle.price(chainId);
    }

    fallback() external payable {
        revert("Unsupported");
    }

    receive() external payable {
        emit ReceivedGas(msg.sender, msg.value);
    }
}
