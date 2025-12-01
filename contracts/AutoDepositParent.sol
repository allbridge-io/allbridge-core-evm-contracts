// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";
import {GasUsage} from "./GasUsage.sol";
import {AutoDepositWallet} from "./AutoDepositWallet.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract AutoDepositParent is GasUsage {
    using SafeERC20 for IERC20Metadata;

    uint internal constant ORACLE_PRECISION = 18;

    uint public immutable chainId;
    uint private immutable chainPrecision;

    mapping(address tokenAddress => bool) public acceptedTokens;
    mapping(address tokenAddress => uint scalingFactor) internal _tokenScalingFactor;
    mapping(address tokenAddress => uint scalingFactor) internal _feeConversionScalingFactor;

    event DepositAddressCreationEvent(
        address recipient,
        address recipientToken,
        uint minDepositAmount,
        uint[] chainIds
    );

    constructor(uint _chainId, uint _chainPrecision, IGasOracle _gasOracle) GasUsage(_gasOracle) {
        chainId = _chainId;
        chainPrecision = _chainPrecision;
    }

    function createDepositWalletsBatch(
        address _recipient,
        address _recipientToken,
        uint _minDepositAmount,
        uint _feeTokenAmount,
        uint[] calldata _chainIds
    ) external payable {
        require(_recipient != address(0), "ADF: recipient is zero");
        require(_minDepositAmount > 0, "ADF: minDepositAmount is zero");
        uint fee = msg.value + _convertFeeFromTokensToNativeToken(msg.sender, _recipientToken, _feeTokenAmount);
        uint requiredFee = 0;
        for (uint i = 0; i < _chainIds.length; i++) {
            requiredFee += this.getTransactionCost(_chainIds[i]);
        }
        require(fee >= requiredFee, "ADF: not enough fee");
        emit DepositAddressCreationEvent(_recipient, _recipientToken, _minDepositAmount, _chainIds);
    }

    function withdraw(IERC20Metadata token) external onlyOwner {
        uint toWithdraw = token.balanceOf(address(this));
        if (toWithdraw > 0) {
            token.safeTransfer(msg.sender, toWithdraw);
        }
    }

    function withdrawGas(uint amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
    }

    function registerToken(address tokenAddress) external onlyOwner {
        acceptedTokens[tokenAddress] = true;
        uint tokenDecimals = IERC20Metadata(tokenAddress).decimals();
        _tokenScalingFactor[tokenAddress] = 10 ** tokenDecimals;
        _feeConversionScalingFactor[tokenAddress] = 10 ** (ORACLE_PRECISION - tokenDecimals + chainPrecision);
    }

    function unregisterToken(address tokenAddress) external onlyOwner {
        acceptedTokens[tokenAddress] = false;
        _feeConversionScalingFactor[tokenAddress] = 0;
    }

    function _convertFeeFromTokensToNativeToken(
        address user,
        address tokenAddress,
        uint feeTokenAmount
    ) private returns (uint) {
        if (feeTokenAmount == 0) return 0;
        if (!acceptedTokens[tokenAddress]) return 0;

        IERC20Metadata token = IERC20Metadata(tokenAddress);
        token.safeTransferFrom(user, address(this), feeTokenAmount);

        return (_feeConversionScalingFactor[tokenAddress] * feeTokenAmount) / gasOracle.price(chainId);
    }

    fallback() external payable {
        revert("Unsupported");
    }

    receive() external payable {
        revert("Unsupported");
    }
}
