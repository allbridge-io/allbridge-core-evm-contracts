// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IBridge, MessengerProtocol} from "./interfaces/IBridge.sol";
import {AutoDepositParent} from "./AutoDepositParent.sol";
import {AutoDepositWallet} from "./AutoDepositWallet.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Uncomment this line to use console.log
//import "hardhat/console.sol";

contract AutoDepositFactory is AutoDepositParent {
    using SafeERC20 for IERC20;

    address public immutable autoDepositWalletImplementation;
    bytes32 public immutable create2Prefix;
    // Cost of send bridgeAndSwap transaction in native tokens
    uint public sendTxCost;

    mapping(address tokenAddress => uint scalingFactor) internal _minDepositScalingFactor;

    event AutoDepositWalletDeployedEvent(address wallet);

    constructor(
        uint _chainId,
        uint _chainPrecision,
        IGasOracle _gasOracle,
        uint _create2PrefixByte // 0xff for EVM, 0x41 for Tron
    ) AutoDepositParent(_chainId, _chainPrecision, _gasOracle) {
        autoDepositWalletImplementation = address(new AutoDepositWallet());
        create2Prefix = bytes32(0x5af43d82803e903d91602b57fd5bf300 + _create2PrefixByte);
    }

    function deployDepositWallet(
        uint _recipientChainId,
        address _bridge,
        bytes32 _recipient,
        bytes32 _recipientToken,
        uint _minDepositAmount
    ) external returns (AutoDepositWallet) {
        require(_recipient != 0, "ADF: recipient must be nonzero");
        bytes32 salt = keccak256(
            abi.encodePacked(_recipientChainId, _bridge, _recipient, _recipientToken, _minDepositAmount)
        );
        address computedAddress = _getDepositWalletAddressBySalt(salt);
        if (computedAddress.code.length != 0) {
            return AutoDepositWallet(computedAddress);
        }

        address createdAddress = Clones.cloneDeterministic(autoDepositWalletImplementation, salt);
        AutoDepositWallet created = AutoDepositWallet(createdAddress);
        created.initialize(_recipientChainId, _bridge, _recipient, _recipientToken, _minDepositAmount);

        emit AutoDepositWalletDeployedEvent(createdAddress);
        return created;
    }

    function setSendTxCost(uint value) external onlyOwner {
        sendTxCost = value;
    }

    function createSwapAndBridge(
        uint _recipientChainId,
        address _bridge,
        bytes32 _recipient,
        bytes32 _recipientToken,
        uint _minDepositAmount,
        address _token,
        uint _nonce,
        MessengerProtocol _messenger
    ) external {
        AutoDepositWallet wallet = this.deployDepositWallet(_recipientChainId, _bridge, _recipient, _recipientToken, _minDepositAmount);
        _swapAndBridge(wallet, _token, _nonce, _messenger);
    }

    /// @notice Swaps and bridges using an existing wallet. Ensures wallet exists, token registered, charges fee, calls wallet.swapAndBridge.
    function swapAndBridge(address _wallet, address _token, uint _nonce, MessengerProtocol _messenger) external {
        require(_wallet.code.length != 0, "ADF: wallet not deployed");
        _swapAndBridge(AutoDepositWallet(_wallet), _token, _nonce, _messenger);
    }

    function _swapAndBridge(AutoDepositWallet _wallet, address _token, uint _nonce, MessengerProtocol _messenger) internal {
        uint minAmount = _wallet.minDepositTokenAmount(_token);
        if (minAmount == 0) {
            _wallet.registerToken(_token);
            minAmount = _wallet.minDepositTokenAmount(_token);
        }

        uint tokenAmount = IERC20(_token).balanceOf(address(_wallet));
        require(tokenAmount >= minAmount, "ADF: amount too low");
        uint sendTxFeeTokenAmount = getSendTxFeeTokenAmount(_token);
        IERC20(_token).safeTransferFrom(address (_wallet), address(this), sendTxFeeTokenAmount);
        _wallet.factorySwapAndBridge(_token, tokenAmount - sendTxFeeTokenAmount, _nonce, _messenger);
    }

    function getDepositWalletAddress(
        uint _recipientChainId,
        address _bridge,
        bytes32 _recipient,
        bytes32 _recipientToken,
        uint _minDepositAmount
    ) external view returns (address addr) {
        bytes32 salt = keccak256(
            abi.encodePacked(_recipientChainId, _bridge, _recipient, _recipientToken, _minDepositAmount)
        );

        return _getDepositWalletAddressBySalt(salt);
    }

    function getDepositWalletAddressBySalt(
        bytes32 _salt
    ) external view returns (address addr) {
        return _getDepositWalletAddressBySalt(_salt);
    }

    function _getDepositWalletAddressBySalt(
        bytes32 _salt
    ) internal view returns (address predicted) {
        address implementation = autoDepositWalletImplementation;
        address deployer = address(this);
        bytes32 prefix = create2Prefix;
        assembly {
            let ptr := mload(0x40)
            mstore(add(ptr, 0x38), deployer)
            mstore(add(ptr, 0x24), prefix)
            mstore(add(ptr, 0x14), implementation)
            mstore(ptr, 0x3d602d80600a3d3981f3363d3d373d3d3d363d73)
            mstore(add(ptr, 0x58), _salt)
            mstore(add(ptr, 0x78), keccak256(add(ptr, 0x0c), 0x37))
            predicted := keccak256(add(ptr, 0x43), 0x55)
        }
    }

    function getSendTxFeeTokenAmount(address _token) public view returns (uint) {
        uint scalingFactor = _feeConversionScalingFactor[_token];
        require(scalingFactor > 0, "ADF: unsupported token");
        return (sendTxCost * gasOracle.price(chainId)) / scalingFactor;
    }
}
