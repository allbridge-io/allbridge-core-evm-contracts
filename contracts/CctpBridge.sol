// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";
import {ITokenMessenger} from "./interfaces/cctp/ITokenMessenger.sol";
import {IReceiver} from "./interfaces/cctp/IReceiver.sol";
import {GasUsage} from "./GasUsage.sol";

contract CctpBridge is GasUsage {
    using SafeERC20 for IERC20Metadata;

    uint internal constant ORACLE_PRECISION = 18;
    uint internal constant BP = 1e4;

    uint public immutable chainId;
    // Admin fee share (in basis points)
    uint public adminFeeShareBP;
    IERC20Metadata private immutable token;
    ITokenMessenger private immutable cctpMessenger;
    IReceiver private immutable cctpTransmitter;
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
     * @notice Emitted when tokens are sent on the source blockchain.
     */
    event TokensSent(
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        uint nonce,
        uint receivedRelayerFeeFromGas,
        uint receivedRelayerFeeFromTokens,
        uint relayerFee,
        uint receivedRelayerFeeTokenAmount,
        uint adminFee
    );

    constructor(
        uint chainId_,
        uint chainPrecision_,
        address tokenAddress,
        address cctpMessenger_,
        address cctpTransmitter_,
        IGasOracle gasOracle_
    ) GasUsage(gasOracle_) {
        chainId = chainId_;
        token = IERC20Metadata(tokenAddress);
        uint tokenDecimals = token.decimals();
        cctpMessenger = ITokenMessenger(cctpMessenger_);
        cctpTransmitter = IReceiver(cctpTransmitter_);
        token.approve(cctpMessenger_, type(uint256).max);
        stableTokensForGasScalingFactor = 10 ** (ORACLE_PRECISION - tokenDecimals + chainPrecision_);
        fromGasOracleScalingFactor = 10 ** (ORACLE_PRECISION - tokenDecimals);
    }

    function bridge(
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        uint relayerFeeTokenAmount
    ) external payable returns (uint64 _nonce) {
        require(amount > relayerFeeTokenAmount, "Amount must be > relayerFeeTokenAmount");
        require(recipient != 0, "Recipient must be nonzero");
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint gasFromStables = _getStableTokensValueInGas(relayerFeeTokenAmount);
        uint relayerFee = this.getTransactionCost(destinationChainId);
        require(msg.value + gasFromStables >= relayerFee, "Not enough fee");
        uint amountToSend = amount - relayerFeeTokenAmount;
        uint adminFee = amountToSend * adminFeeShareBP / BP;
        amountToSend -= adminFee;
        uint32 destinationDomain = getDomain(destinationChainId);
        uint64 nonce = cctpMessenger.depositForBurn(amountToSend, destinationDomain, recipient, address(token));
        emit TokensSent(amountToSend, recipient, destinationChainId, nonce, msg.value, gasFromStables, relayerFee, relayerFeeTokenAmount, adminFee);
        return nonce;
    }

    function receiveTokens(address recipient, bytes calldata message, bytes calldata signature) external payable {
        require(cctpTransmitter.receiveMessage(message, signature), "Receive message failed");
        // pass extra gas to the recipient
        if (msg.value > 0) {
            // ignore if passing extra gas failed
            // solc-ignore-next-line unused-call-retval
            payable(recipient).call{value: msg.value}("");
        }
    }

    /**
     * @notice Allows the admin to add new supported chain destination.
     * @param chainId_ The chain ID of the destination to register.
     * @param domain The domain of the destination to register.
     */
    function registerBridgeDestination(uint chainId_, uint32 domain) external onlyOwner {
        chainIdDomainMap[chainId_] = domain + 1;
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
        require(adminFeeShareBP_ <= BP, "Too high");
        adminFeeShareBP = adminFeeShareBP_;
    }

    /**
     * @notice Calculates the amount of bridging fee nominated in the stable token.
     * @param destinationChainId The ID of the destination chain.
     * @return The total price of bridging, with the precision according to the token's `decimals()` value.
     */
    function getBridgingCostInTokens(uint destinationChainId) external view returns (uint) {
        return
            gasOracle.getTransactionGasCostInUSD(destinationChainId, gasUsage[destinationChainId]) /
            fromGasOracleScalingFactor;
    }

    function getDomain(uint chainId_) public view returns (uint32) {
        uint256 domainNumber = chainIdDomainMap[chainId_];
        require(domainNumber > 0, "Unknown chain id");
        return uint32(domainNumber - 1);
    }

    /**
     * @notice Calculates the amount of gas equivalent in value to provided amount of tokens
     * according to the current exchange rate.
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
