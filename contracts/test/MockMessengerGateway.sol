// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {MessengerProtocol} from "../interfaces/IBridge.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IMessengerGateway} from "../interfaces/IMessengerGateway.sol";

abstract contract MockMessengerGateway is IMessengerGateway {
    uint private mockedMessageCost = 20000;

    function getMessageCost(uint chainId, MessengerProtocol protocol) external view override returns (uint) {
        return mockedMessageCost;
    }

    function getMessageGasUsage(uint chainId, MessengerProtocol protocol) public view override returns (uint) {
        return 0;
    }

    function hasReceivedMessage(bytes32 message, MessengerProtocol protocol) external view override returns (bool) {
        return false;
    }

    function hasSentMessage(bytes32 message) external view override returns (bool) {
        return false;
    }

    function mockMessageCost(uint _value) external {
        mockedMessageCost = _value;
    }
}
