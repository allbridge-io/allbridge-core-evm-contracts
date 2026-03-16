// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";
import {IXReserve} from "./interfaces/xreserve/IXReserve.sol";
import {GasUsage} from "./GasUsage.sol";

contract XReserveBridge is GasUsage {
    using SafeERC20 for IERC20Metadata;

    uint internal constant ORACLE_PRECISION = 18;
    uint internal constant BP = 1e4;
    uint internal constant MAX_FEE_SHARE_P = 1e9;

    uint public immutable chainId;
    // Admin fee share (in basis points)
    uint public adminFeeShareBP;
    uint public maxFeeShare = 100000;
    IERC20Metadata private immutable token;
    IXReserve private immutable xReserve;
    // precomputed value of the scaling factor required for converting the stable token to gas amount
    uint private immutable stableTokensForGasScalingFactor;
    // precomputed value to divide by to change the precision from the Gas Oracle precision to the stable token precision
    uint private immutable fromGasOracleScalingFactor;

    mapping(uint chainId => uint domainNumber) private chainIdDomainMap;

    /**
     * @notice Emitted when the contract receives some gas directly.
     */
    event ReceivedGas(address sender, uint amount);

    /**
     * @notice Emitted when the contract receives message
     */
    event ReceivedMessageId(bytes32 messageId);

    /**
     * @notice Emitted when the contract sends some extra gas to the recipient of tokens.
     */
    event ReceivedExtraGas(address recipient, uint amount);

    /**
     * @notice Emitted when tokens are sent on the source blockchain.
     */
    event TokensSent(
        address sender,
        bytes32 recipient,
        uint amount,
        uint destinationChainId,
        uint receivedRelayerFeeFromGas,
        uint receivedRelayerFeeFromTokens,
        uint relayerFee,
        uint receivedRelayerFeeTokenAmount,
        uint adminFeeTokenAmount,
        uint maxFee
    );

    event TokensSentExtras(bytes32 recipientWalletAddress);

    constructor(
        uint chainId_,
        uint chainPrecision_,
        address tokenAddress,
        address xReserve_,
        IGasOracle gasOracle_
    ) GasUsage(gasOracle_) {
        chainId = chainId_;
        token = IERC20Metadata(tokenAddress);
        uint tokenDecimals = token.decimals();
        xReserve = IXReserve(xReserve_);
        token.approve(xReserve_, type(uint256).max);
        stableTokensForGasScalingFactor = 10 ** (ORACLE_PRECISION - tokenDecimals + chainPrecision_);
        fromGasOracleScalingFactor = 10 ** (ORACLE_PRECISION - tokenDecimals);
    }

    /**
     * @notice Initiates a bridging process of the token to another blockchain via xReserve.
     * @param amount The amount of tokens to send (including `relayerFeeTokenAmount`).
     * @param recipient The recipient address.
     * @param destinationChainId The ID of the destination chain.
     * @param relayerFeeTokenAmount The amount of tokens to be deducted from the transferred amount as a bridging fee.
     */
    function bridge(
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        uint relayerFeeTokenAmount
    ) public payable {
        require(amount > relayerFeeTokenAmount, "XRB: Amount <= relayer fee");
        require(recipient != 0, "XRB: Recipient must be nonzero");
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint gasFromStables = _getStableTokensValueInGas(relayerFeeTokenAmount);
        uint relayerFee = this.getTransactionCost(destinationChainId);
        require(msg.value + gasFromStables >= relayerFee, "XRB: Not enough fee");
        uint amountToSend = amount - relayerFeeTokenAmount;
        uint adminFee;
        if (adminFeeShareBP != 0) {
            adminFee = (amountToSend * adminFeeShareBP) / BP;
            if (adminFee == 0) {
                adminFee = 1;
            }
            amountToSend -= adminFee;
        }
        uint32 destinationDomain = getDomainByChainId(destinationChainId);
        uint maxFee = (amountToSend * maxFeeShare) / MAX_FEE_SHARE_P + 1;
        xReserve.depositToRemote(
            amountToSend,
            destinationDomain,
            recipient,
            address(token),
            maxFee,
            ""
        );
        emit TokensSent(
            msg.sender,
            recipient,
            amountToSend,
            destinationChainId,
            msg.value,
            gasFromStables,
            relayerFee,
            relayerFeeTokenAmount,
            adminFee,
            maxFee
        );
    }

    /**
     * @notice Public method to initiate a bridging process. Used for recipients with different wallet address (Solana).
     * @param recipientWalletAddress The recipient wallet address.
     **/
    function bridgeWithWalletAddress(
        uint amount,
        bytes32 recipient,
        bytes32 recipientWalletAddress,
        uint destinationChainId,
        uint relayerFeeTokenAmount
    ) external payable {
        bridge(amount, recipient, destinationChainId, relayerFeeTokenAmount);

        emit TokensSentExtras(recipientWalletAddress);
    }

    /**
     * @notice Completes the bridging process by sending the tokens on the destination blockchain.
     * @param recipient The recipient address.
     * @param messageId The message id to connect sent and received transaction (Sent tx id)
     * @param message The message information.
     * @param signature Concatenated 65-byte signature(s) of `message`.
     */
    function receiveTokens(
        address recipient,
        bytes32 messageId,
        bytes calldata message,
        bytes calldata signature
    ) external payable {
        xReserve.withdraw(message, signature);
        // pass extra gas to the recipient
        if (msg.value > 0) {
            (bool sent, ) = payable(recipient).call{value: msg.value}("");
            if (sent) {
                emit ReceivedExtraGas(recipient, msg.value);
            }
        }

        emit ReceivedMessageId(messageId);
    }

    /**
     * @notice Allows the admin to add new supported chain destination.
     * @param chainId_ The chain ID of the destination to register.
     * @param domain The domain of the destination to register.
     */
    function registerBridgeDestination(uint chainId_, uint32 domain) external onlyOwner {
        chainIdDomainMap[chainId_] = domain;
    }

    /**
     * @notice Allows the admin to remove a chain from the map of supported destinations.
     * @param chainId_ The chain ID of the destination to unregister.
     */
    function unregisterBridgeDestination(uint chainId_) external onlyOwner {
        chainIdDomainMap[chainId_] = 0;
    }

    /**
     * @notice Allows the admin to withdraw the relayer fee collected in gas tokens.
     */
    function withdrawGas(uint amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
    }

    /**
     * @notice Allows the admin to withdraw the admin fee and relayer fee collected in tokens.
     */
    function withdrawFeeInTokens() external onlyOwner {
        uint toWithdraw = token.balanceOf(address(this));
        if (toWithdraw > 0) {
            token.safeTransfer(msg.sender, toWithdraw);
        }
    }

    /**
     * @notice Sets the basis points of the admin fee share from each bridge.
     */
    function setAdminFeeShare(uint adminFeeShareBP_) external onlyOwner {
        require(adminFeeShareBP_ <= BP, "XRB: Too high");
        adminFeeShareBP = adminFeeShareBP_;
    }

    /**
     * @notice Sets the maximum fee share for the relayer.
     */
    function setMaxFeeShare(uint maxFeeShare_) external onlyOwner {
        require(maxFeeShare_ <= MAX_FEE_SHARE_P, "XRB: Too high");
        maxFeeShare = maxFeeShare_;
    }

    /**
     * @notice Calculates the amount of bridging fee nominated in the stable token.
     * @param destinationChainId The ID of the destination chain.
     * @return The total price of bridging.
     */
    function getBridgingCostInTokens(uint destinationChainId) external view returns (uint) {
        return
            gasOracle.getTransactionGasCostInUSD(destinationChainId, gasUsage[destinationChainId]) /
            fromGasOracleScalingFactor;
    }

    function getDomainByChainId(uint chainId_) public view returns (uint32) {
        uint domainNumber = chainIdDomainMap[chainId_];
        require(domainNumber > 0, "XRB: Unknown chain id");
        return uint32(domainNumber);
    }

    /**
     * @notice Calculates the amount of gas equivalent in value to provided amount of tokens.
     * @param stableTokenAmount The amount of tokens.
     * @return amount of gas tokens.
     */
    function _getStableTokensValueInGas(uint stableTokenAmount) internal view returns (uint) {
        if (stableTokenAmount == 0) return 0;
        return (stableTokensForGasScalingFactor * stableTokenAmount) / gasOracle.price(chainId);
    }

    fallback() external payable {
        revert("Unsupported");
    }

    receive() external payable {
        emit ReceivedGas(msg.sender, msg.value);
    }
}
