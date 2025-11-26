// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {MessengerProtocol} from "../interfaces/IBridge.sol";
import {ICctpBridge} from "../interfaces/ICctpBridge.sol";
import {MockGasUsage} from "./MockGasUsage.sol";

contract MockCctpBridge is MockGasUsage, ICctpBridge {
    uint public override chainId = 0;
    uint public override adminFeeShareBP = 0;

    event BridgeEvent(uint amount, bytes32 recipient, uint destinationChainId, uint relayerFeeTokenAmount, uint value);

    function bridge(
        uint _amount,
        bytes32 _recipient,
        uint _destinationChainId,
        uint _relayerFeeTokenAmount
    ) public payable override {
        emit BridgeEvent(_amount, _recipient, _destinationChainId, _relayerFeeTokenAmount, msg.value);
    }

    function bridgeWithWalletAddress(
        uint _amount,
        bytes32 _recipient,
        bytes32 _recipientWalletAddress,
        uint _destinationChainId,
        uint _relayerFeeTokenAmount
    ) external payable override {
        bridge(_amount, _recipient, _destinationChainId, _relayerFeeTokenAmount);
    }

    function getBridgingCostInTokens(
        uint destinationChainId,
        MessengerProtocol messenger,
        address tokenAddress
    ) external view override returns (uint) {
        return 0;
    }
}
