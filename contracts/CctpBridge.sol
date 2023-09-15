// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";
import {ITokenMessenger} from "./interfaces/cctp/ITokenMessenger.sol";
import {IReceiver} from "./interfaces/cctp/IReceiver.sol";
import {Stoppable} from "./Stoppable.sol";
import {GasUsage} from "./GasUsage.sol";

contract CctpBridge is Stoppable, GasUsage {
    using SafeERC20 for IERC20Metadata;
    using EnumerableMap for EnumerableMap.UintToUintMap;

    uint public immutable chainId;
    uint internal constant ORACLE_PRECISION = 18;
    IERC20Metadata private immutable token;
    ITokenMessenger private immutable cctpMessenger;
    IReceiver private immutable cctpTransmitter;
    uint private immutable stableTokensForGasScalingFactor;
    EnumerableMap.UintToUintMap private chainIdDomainMap;

    /**
     * @notice Emitted when the contract is supplied with the gas for bridging.
     */
    event ReceivedGas(address sender, uint amount);

    /**
     * @notice Emitted when this contract receives some relayer fee / extra gas either as gas tokens or as stable tokens.
     */
    event ReceivedRelayerFeeAndExtraGas(uint fromGas, uint fromStableTokens);

    /**
     * @dev Emitted when tokens are sent on the source blockchain.
     */
    event TokensSent(uint amount, bytes32 recipient, uint destinationChainId, uint nonce);

    constructor(
        uint chainId_,
        address tokenAddress,
        address cctpMessenger_,
        address cctpTransmitter_,
        uint chainPrecision_,
        IGasOracle gasOracle_
    ) GasUsage(gasOracle_) {
        chainId = chainId_;
        token = IERC20Metadata(tokenAddress);
        uint tokenDecimals = token.decimals();
        cctpMessenger = ITokenMessenger(cctpMessenger_);
        cctpTransmitter = IReceiver(cctpTransmitter_);
        stableTokensForGasScalingFactor = 10 ** (ORACLE_PRECISION - tokenDecimals + chainPrecision_);
    }

    function bridge(
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        uint feeTokenAmount
    ) external payable whenNotStopped returns (uint64 _nonce) {
        require(amount > feeTokenAmount, "amount too low for fee");
        require(recipient != 0, "bridge to the zero address");
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint gasFromStables = _getStableTokensValueInGas(feeTokenAmount);
        uint relayerFee = msg.value + gasFromStables;
        require(relayerFee >= this.getTransactionCost(destinationChainId), "not enough fee");
        emit ReceivedRelayerFeeAndExtraGas(msg.value, gasFromStables);
        uint amountAfterFee = amount - feeTokenAmount;
        uint32 destinationDomain = getDomain(destinationChainId);
        uint64 nonce = cctpMessenger.depositForBurn(amountAfterFee, destinationDomain, recipient, address(token));
        emit TokensSent(amount, recipient, destinationChainId, nonce);
        return nonce;
    }

    function receiveTokens(
        address recipient,
        bytes calldata message,
        bytes calldata signature
    ) external payable whenNotStopped {
        require(cctpTransmitter.receiveMessage(message, signature), "receive message failed");
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
        EnumerableMap.set(chainIdDomainMap, chainId_, domain);
    }

    /**
     * @notice Allows the admin to withdraw the relayer fee collected in gas tokens.
     */
    function withdrawGas(uint amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
    }

    /**
     * @notice Allows the admin to withdraw the relayer fee collected in tokens.
     */
    function withdrawRelayerFeeInTokens() external onlyOwner {
        uint toWithdraw = token.balanceOf(address(this));
        if (toWithdraw > 0) {
            token.safeTransfer(msg.sender, toWithdraw);
        }
    }

    function getDomain(uint chainId_) public view returns (uint32) {
        (bool isKnownChainId, uint256 domain) = EnumerableMap.tryGet(chainIdDomainMap, chainId_);
        require(isKnownChainId, "Unknown chain id");
        return uint32(domain);
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
