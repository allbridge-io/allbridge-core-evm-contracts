// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";

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
    IGasOracle private gasOracle;
    mapping(uint id => TargetMeta) public targets;

    uint private immutable chainId;
    uint public constant PRICE_PRECISION = 18;
    uint private constant CHAIN_PRECISION = 18;
    uint private constant ORACLE_PRECISION = 18;
    /**
     * Price of ABR0 in USD with decimals PRICE_PRECISION
     */
    uint public price;
    uint private immutable conversionScalingFactor;

    /**
     * @dev Emitted when ABR0 tokens are spent.
     */
    event ConvertedAbr(uint abrAmount, uint convertedNativeAmount, uint receivedNativeAmount);

    constructor(address _abrTokenAddress, address _gasOracle, uint _chainId) {
        abrToken = IERC20Metadata(_abrTokenAddress);
        uint abrTokenDecimals = abrToken.decimals();
        conversionScalingFactor = 10 ** (CHAIN_PRECISION + ORACLE_PRECISION - PRICE_PRECISION - abrTokenDecimals);
        gasOracle = IGasOracle(_gasOracle);
        chainId = _chainId;
    }

    function transferTokensAndCallTarget(
        address _token,
        uint _amount,
        uint _abrAmount,
        uint _targetId,
        bytes calldata _params
    ) external payable {
        // convert ABR into native tokens
        uint convertedNativeAmount = _covertAbrToNativeTokens(_abrAmount);
        emit ConvertedAbr(_abrAmount, convertedNativeAmount, msg.value);

        // transfer the tokens for bridging
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        _routeCall(_targetId, convertedNativeAmount + msg.value, _params);
    }

    function registerTarget(uint _id, address _target, string calldata _signature) external onlyOwner {
        require(_target != address(0), "Payer: target is zero");
        require(_target.code.length > 0, "Payer: target is not a contract");
        require(bytes(_signature).length > 0, "Payer: signature is empty");

        targets[_id] = TargetMeta({target: _target, selector: bytes4(keccak256(bytes(_signature)))});
    }

    function unregisterTarget(uint _id) external onlyOwner {
        delete targets[_id];
    }

    /**
     * @dev Set the price of ABR0 in USD with decimals PRICE_PRECISION.
     */
    function setPrice(uint _newPrice) external onlyOwner {
        price = _newPrice;
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
     * @dev Sets the Gas Oracle contract address.
     * @param _gasOracle The address of the Gas Oracle contract.
     */
    function setGasOracle(IGasOracle _gasOracle) external onlyOwner {
        gasOracle = _gasOracle;
    }

    /**
     * @notice Calculate ABR0 amount from native tokens amount based on current exchange rates
     */
    function nativeTokensToAbr(uint _amount) external view returns (uint) {
        return (_amount * gasOracle.price(chainId)) / (price * conversionScalingFactor);
    }

    /**
     * @notice Calculate native token amount from ABR0 tokens based on current exchange rates
     */
    function abrToNativeTokens(uint _abrAmount) public view returns (uint) {
        return (_abrAmount * conversionScalingFactor * price) / gasOracle.price(chainId);
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

    function _covertAbrToNativeTokens(uint _abrAmount) internal returns (uint) {
        abrToken.safeTransferFrom(msg.sender, address(this), _abrAmount);
        return abrToNativeTokens(_abrAmount);
    }

    receive() external payable {}

    fallback() external payable {
        revert("Unsupported");
    }
}
