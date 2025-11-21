// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {GasUsage} from "./GasUsage.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IMessengerGateway} from "./interfaces/IMessengerGateway.sol";

import {MessengerProtocol, IBridge} from "./interfaces/IBridge.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Uncomment this line to use console.log
//import "hardhat/console.sol";

contract BridgePayerWithToken is Ownable {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IERC20;

    IERC20Metadata public abrToken;
    address public bridge;

    uint private constant EXCHANGE_RATE_PRECISION = 18;
    /**
     * Exchange rate: ABR tokens per native tokens with decimals EXCHANGE_RATE_PRECISION
     */
    uint public exchangeRate;
    uint private immutable chainPrecision;
    uint private immutable conversionScalingFactor;

    constructor(address _abrTokenAddress, uint _chainPrecision, address _bridgeAddress) {
        chainPrecision = _chainPrecision;
        bridge = _bridgeAddress;
        abrToken = IERC20Metadata(_abrTokenAddress);
        uint abrTokenDecimals = abrToken.decimals();
        conversionScalingFactor = 10 ** (EXCHANGE_RATE_PRECISION + chainPrecision - abrTokenDecimals);
    }

    /**
     * @dev Bridge stable tokens using ABR for bridging fee.
     */
    function swapAndBridge(
        bytes32 _token,
        uint _amount,
        bytes32 _recipient,
        uint _destinationChainId,
        bytes32 _receiveToken,
        uint _nonce,
        MessengerProtocol _messenger
    ) external payable {
        uint feeAmount = _getBridgeFeeInNativeTokens(_destinationChainId, _messenger);

        // charge bridging fee in ABR
        uint abrNeeded = _calculateBridgeFeeInAbr(feeAmount);
        abrToken.safeTransferFrom(msg.sender, address(this), abrNeeded);

        address tokenAddress = address(uint160(uint256(_token)));
        // transfer tokens to bridge
        IERC20(tokenAddress).safeTransferFrom(msg.sender, address(this), _amount);

        IBridge(payable(bridge)).swapAndBridge{value: feeAmount}(
            _token,
            _amount,
            _recipient,
            _destinationChainId,
            _receiveToken,
            _nonce,
            _messenger,
            0
        );
    }

    /**
     * @dev Get ABR amount enough to pay the bridging fee.
     */
    function getBridgeFeeInAbr(uint _destinationChainId, MessengerProtocol _messenger) external view returns (uint) {
        return _calculateBridgeFeeInAbr(_getBridgeFeeInNativeTokens(_destinationChainId, _messenger));
    }

    /**
     * @dev Function to update the exchange rate between ABR0 and ETH by the owner.
     */
    function setExchangeRate(uint _newExchangeRate) external onlyOwner {
        require(_newExchangeRate > 0, "New exchange rate must be greater than zero");

        exchangeRate = _newExchangeRate;
    }

    function setBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }

    function approveBridgeToken(address _tokenAddress) external onlyOwner {
        IERC20(_tokenAddress).safeApprove(bridge, type(uint256).max);
    }

    /**
     * @notice Withdraw gas tokens.
     */
    function withdrawGas(uint amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
    }

    /**
     * @notice Withdraw the tokens.
     */
    function withdrawTokens(address tokenAddress) external onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        uint toWithdraw = token.balanceOf(address(this));
        if (toWithdraw > 0) {
            token.safeTransfer(msg.sender, toWithdraw);
        }
    }

    /**
     * @dev Get native token amount enough to pay the bridging fee.
     */
    function _getBridgeFeeInNativeTokens(
        uint _destinationChainId,
        MessengerProtocol _messenger
    ) internal view returns (uint) {
        return
            IMessengerGateway(payable(bridge)).getMessageCost(_destinationChainId, _messenger) +
            GasUsage(payable(bridge)).getTransactionCost(_destinationChainId);
    }

    /**
     * @dev Calculate ABR amount enough to pay bridging fee.
     */
    function _calculateBridgeFeeInAbr(uint _feeAmount) internal view returns (uint) {
        return (_feeAmount * exchangeRate) / conversionScalingFactor;
    }

    receive() external payable {}

    fallback() external payable {
        revert("Unsupported");
    }
}
