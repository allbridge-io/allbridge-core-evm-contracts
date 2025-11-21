// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {MessengerProtocol} from "./IBridge.sol";

interface IMessengerGateway {
    function getMessageCost(uint chainId, MessengerProtocol protocol) external view returns (uint);

    function getMessageGasUsage(uint chainId, MessengerProtocol protocol) external view returns (uint);

    function hasReceivedMessage(bytes32 message, MessengerProtocol protocol) external view returns (bool);

    function hasSentMessage(bytes32 message) external view returns (bool);
}
