// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {GasUsage} from "./GasUsage.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";
import {IMessageTransmitter} from "./interfaces/cctp/IMessageTransmitter.sol";
import {ITokenMessenger} from "./interfaces/cctp/ITokenMessenger.sol";
import {OptionsBuilder} from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OptionsBuilder.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {SendParam, IOFT, MessagingFee} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

contract OftBridge is Ownable {
    using SafeERC20 for IERC20;
    using OptionsBuilder for bytes;

    uint internal constant ORACLE_PRECISION = 18;
    uint internal constant BP = 1e4;
    uint private immutable chainPrecision;
    IGasOracle internal gasOracle;

    uint public immutable chainId;
    // Admin fee share (in basis points)
    uint public adminFeeShareBP;
    // precomputed values to divide by to change the precision from the Gas Oracle precision to the token precision
    mapping(address tokenAddress => uint scalingFactor) internal fromGasOracleScalingFactor;
    mapping(uint chainId => uint32 eid) private chainIdEidMap;
    mapping(uint chainId => uint maxExtraGas) internal maxExtraGas;
    mapping(address tokenAddress => address oftAddress) public oftAddress;

    /**
     * @notice Emitted when the contract receives some gas directly.
     */
    event ReceivedGas(address sender, uint amount);

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

    constructor(
        uint chainId_,
        uint chainPrecision_,
        IGasOracle gasOracle_
    ) {
        chainId = chainId_;
        gasOracle = gasOracle_;
        chainPrecision = chainPrecision_;
    }

    function bridge(
        address oft,
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        uint relayerFeeTokenAmount,
        uint extraGasDestinationToken,
        uint slippageBP
    ) public payable {
        require(amount > relayerFeeTokenAmount, "Amount <= relayer fee");
        require(recipient != 0, "Recipient must be nonzero");
        require(slippageBP <= BP, "Too high");

        address tokenAddress = IOFT(oft).token();
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), amount);

        require(maxExtraGas[destinationChainId] == 0 || extraGasDestinationToken <= maxExtraGas[destinationChainId], "Extra gas too high");

        bytes memory options = OptionsBuilder.newOptions();
        if (extraGasDestinationToken > 0) {
            options = options.addExecutorNativeDropOption(uint128(extraGasDestinationToken), recipient);
        }
        uint amountToSend = amount - relayerFeeTokenAmount;
        uint adminFee;
        if (adminFeeShareBP != 0) {
            adminFee = (amountToSend * adminFeeShareBP) / BP;
            if (adminFee == 0) {
                adminFee = 1;
            }
            amountToSend -= adminFee;
        }

        SendParam memory sendParam = SendParam(
            getEidByChainId(destinationChainId),
            recipient,
            amountToSend,
            amountToSend - (amountToSend * slippageBP / BP), //min amount (slippage)
            options,
            "",
            ""
        );

        MessagingFee memory messagingFee = IOFT(oft).quoteSend(sendParam, false);

        uint gasFromStables = _getStableTokensValueInGas(oft, relayerFeeTokenAmount);
        require(msg.value + gasFromStables >= messagingFee.nativeFee, "Not enough fee");

        IOFT(oft).send{value: messagingFee.nativeFee}(sendParam, messagingFee, msg.sender);

        emit OftTokensSent(msg.sender,
            recipient,
            tokenAddress,
            amountToSend,
            destinationChainId,
            msg.value,
            gasFromStables,
            messagingFee.nativeFee,
            relayerFeeTokenAmount,
            adminFee,
            extraGasDestinationToken);
    }

    function relayerFee(address tokenAddress, uint destinationChainId) external view returns (uint) {
        address oft = oftAddress[tokenAddress];
        require(oft != address(0), "Token is not registered");
        MessagingFee memory messagingFee = IOFT(oft).quoteSend(_createEmptySendParam(destinationChainId, 0), false);
        return messagingFee.nativeFee;
    }

    function extraGasPrice(address tokenAddress, uint destinationChainId, uint128 extraGasAmount) external view returns (uint) {
        address oft = oftAddress[tokenAddress];
        require(oft != address(0), "Token is not registered");
        MessagingFee memory messagingFee1 = IOFT(oft).quoteSend(_createEmptySendParam(destinationChainId, extraGasAmount), false);
        MessagingFee memory messagingFee2 = IOFT(oft).quoteSend(_createEmptySendParam(destinationChainId, extraGasAmount * 2), false);

        return messagingFee2.nativeFee - messagingFee1.nativeFee;
    }

    function _createEmptySendParam(
        uint destinationChainId, uint128 extraGasDestinationToken
    ) private view returns (SendParam memory) {
        bytes memory options = OptionsBuilder.newOptions();
        if (extraGasDestinationToken > 0) {
            options = options.addExecutorNativeDropOption(extraGasDestinationToken, bytes32(0));
        }
        return SendParam(
            getEidByChainId(destinationChainId),
            bytes32(0),
            0,
            0,
            options,
            "",
            ""
        );
    }


    function registerBridgeDestination(uint chainId_, uint32 eid_) external onlyOwner {
        chainIdEidMap[chainId_] = eid_;
    }

    /**
     * @notice Allows the admin to remove a chain from the map of supported destinations.
     * @param chainId_ The chain ID of the destination to unregister.
     */
    function unregisterBridgeDestination(uint chainId_) external onlyOwner {
        chainIdEidMap[chainId_] = 0;
    }

    /**
     * @notice Allows the admin to withdraw the relayer fee collected in gas tokens.
     */
    function withdrawGas(uint amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
    }

    function addToken(address oft) external onlyOwner {
        address tokenAddress = IOFT(oft).token();
        uint tokenDecimals = IERC20Metadata(tokenAddress).decimals();
        IERC20(tokenAddress).approve(oft, type(uint256).max);
        fromGasOracleScalingFactor[oft] = 10 ** (ORACLE_PRECISION - tokenDecimals);
        oftAddress[tokenAddress] = oft;
    }

    function removeToken(address oft) external onlyOwner {
        fromGasOracleScalingFactor[oft] = 0;
        address tokenAddress = IOFT(oft).token();
        IERC20(tokenAddress).approve(oft, 0);
        oftAddress[tokenAddress] = address(0);
    }

    /**
     * @notice Allows the admin to withdraw the admin fee and relayer fee collected in tokens.
     */
    function withdrawFeeInTokens(IERC20 token) external onlyOwner {
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

    function setMaxExtraGas(uint chainId_, uint maxExtraGas_) external onlyOwner {
        maxExtraGas[chainId_] = maxExtraGas_;
    }


    function getEidByChainId(uint chainId_) public view returns (uint32) {
        uint32 domainNumber = chainIdEidMap[chainId_];
        require(domainNumber > 0, "Unknown chain id");
        return domainNumber;
    }

    /**
     * @notice Calculates the amount of gas equivalent in value to provided amount of tokens
     * according to the current exchange rate.
     * @param stableTokenAmount The amount of tokens.
     * @return amount of gas tokens.
     */
    function _getStableTokensValueInGas(address oft, uint stableTokenAmount) internal view returns (uint) {
        require(fromGasOracleScalingFactor[oft] > 0, "Token is not set");
        if (stableTokenAmount == 0) return 0;
        return (fromGasOracleScalingFactor[oft] * stableTokenAmount) / gasOracle.price(chainId);
    }

    fallback() external payable {
        revert("Unsupported");
    }

    receive() external payable {
        emit ReceivedGas(msg.sender, msg.value);
    }
}
