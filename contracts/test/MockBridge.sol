// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {MockGasUsage} from "./MockGasUsage.sol";
import {MessengerProtocol, IBridge} from "../interfaces/IBridge.sol";
import {MockMessengerGateway} from "./MockMessengerGateway.sol";
import {MockRouter} from "./MockRouter.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockBridge is MockGasUsage, MockRouter, MockMessengerGateway, IBridge {
    uint public chainId;
    mapping(bytes32 messageHash => uint isProcessed) public override processedMessages;
    mapping(bytes32 messageHash => uint isSent) public override sentMessages;
    // Info about bridges on other chains
    mapping(uint chainId => bytes32 bridgeAddress) public override otherBridges;
    // Info about tokens on other chains
    mapping(uint chainId => mapping(bytes32 tokenAddress => bool isSupported)) public override otherBridgeTokens;

    bool private mockedRevertNotEnoughFee = false;

    event SwapAndBridgeEvent(
        bytes32 token,
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        bytes32 receiveToken,
        uint nonce,
        MessengerProtocol messenger,
        uint feeTokenAmount,
        uint value
    );

    constructor() {}

    function swapAndBridge(
        bytes32 token,
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        bytes32 receiveToken,
        uint nonce,
        MessengerProtocol messenger,
        uint feeTokenAmount
    ) external payable override {
        require(!mockedRevertNotEnoughFee, "Bridge: not enough fee");
        emit SwapAndBridgeEvent(
            token,
            amount,
            recipient,
            destinationChainId,
            receiveToken,
            nonce,
            messenger,
            feeTokenAmount,
            msg.value
        );
    }

    function receiveTokens(
        uint amount,
        bytes32,
        uint,
        bytes32 receiveToken,
        uint,
        MessengerProtocol,
        uint receiveAmountMin
    ) external payable override {}

    function withdrawGasTokens(uint amount) external override onlyOwner {}

    function registerBridge(uint chainId_, bytes32 bridgeAddress_) external override onlyOwner {}

    function addBridgeToken(uint chainId_, bytes32 tokenAddress_) external override onlyOwner {}

    function removeBridgeToken(uint chainId_, bytes32 tokenAddress_) external override onlyOwner {}

    function getBridgingCostInTokens(uint, MessengerProtocol, address) external pure override returns (uint) {
        return 10000;
    }

    function hashMessage(
        uint,
        bytes32,
        uint,
        uint,
        bytes32,
        uint,
        MessengerProtocol
    ) external pure override returns (bytes32) {
        return 0;
    }

    function mockRevertNotEnoughFee(bool _value) external {
        mockedRevertNotEnoughFee = _value;
    }
}
