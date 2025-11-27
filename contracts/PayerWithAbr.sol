// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Uncomment this line to use console.log
//import "hardhat/console.sol";

contract PayerWithAbr is Ownable {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IERC20;

    struct TargetMeta {
        address target;
        bytes4 selector;
    }

    IERC20Metadata public abrToken;
    mapping(uint id => TargetMeta) public targets;

    uint private constant EXCHANGE_RATE_PRECISION = 18;
    /**
     * Exchange rate: ABR tokens per native tokens with decimals EXCHANGE_RATE_PRECISION
     */
    uint public exchangeRate;
    uint private immutable conversionScalingFactor;

    constructor(address _abrTokenAddress, uint _chainPrecision) {
        abrToken = IERC20Metadata(_abrTokenAddress);
        uint abrTokenDecimals = abrToken.decimals();
        conversionScalingFactor = 10 ** (EXCHANGE_RATE_PRECISION + _chainPrecision - abrTokenDecimals);
    }

    function transferTokensAndCallTarget(
        address _token,
        uint _amount,
        uint _abrAmount,
        uint _targetId,
        bytes calldata _params
    ) external payable {
        // convert ABR into native tokens
        uint nativeAmount = _coverBridgingFee(_abrAmount);
        // transfer the tokens for bridging
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        _routeCall(_targetId, nativeAmount, _params);
    }

    function registerTarget(uint _id, address _target, string calldata _signature) external onlyOwner {
        require(_target != address(0), "Payer: target is zero");
        require(_target.code.length > 0, "Payer: target is not a contract");
        require(bytes(_signature).length > 0, "Payer: signature is empty");

        targets[_id] = TargetMeta({target: _target, selector: bytes4(keccak256(bytes(_signature)))});
    }

    /**
     * @dev Set the exchange rate of ABR per gas token with decimals EXCHANGE_RATE_PRECISION.
     */
    function setExchangeRate(uint _newExchangeRate) external onlyOwner {
        exchangeRate = _newExchangeRate;
    }

    function approveBridgeToken(address _tokenAddress, address _bridge) external onlyOwner {
        IERC20(_tokenAddress).safeApprove(_bridge, type(uint256).max);
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
     * @notice Calculate ABR amount from native tokens based on exchange rate
     */
    function nativeTokensToAbr(uint _amount) external view returns (uint) {
        return (_amount * exchangeRate) / conversionScalingFactor;
    }

    function _routeCall(uint _targetId, uint _value, bytes calldata _params) internal {
        TargetMeta memory m = targets[_targetId];
        require(m.target != address(0), "Payer: target not found");

        (bool success, bytes memory returnData) = m.target.call{value: _value}(abi.encodePacked(m.selector, _params));
        if (!success) {
            // Revert the transaction
            if (returnData.length > 0) {
                // Decode the error message
                assembly {
                    revert(add(32, returnData), mload(returnData))
                }
            } else {
                revert("Payer: target call failed");
            }
        }
    }

    function _coverBridgingFee(uint _feeAbrAmount) internal returns (uint) {
        abrToken.safeTransferFrom(msg.sender, address(this), _feeAbrAmount);
        return msg.value + _abrToNativeTokens(_feeAbrAmount);
    }

    /**
     * @notice Calculate native token amount from ABR tokens based on exchange rate
     */
    function _abrToNativeTokens(uint _abrAmount) internal view returns (uint) {
        return (_abrAmount * conversionScalingFactor) / exchangeRate;
    }

    receive() external payable {}

    fallback() external payable {
        revert("Unsupported");
    }
}
