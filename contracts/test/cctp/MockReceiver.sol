// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IReceiver} from "../../interfaces/cctp/IReceiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockReceiver is IReceiver {
    bool private mockedReceiveMessageResult;

    event ReceiveMessageEvent(bytes message, bytes signature);

    function receiveMessage(bytes calldata message, bytes calldata signature) external returns (bool success) {
        emit ReceiveMessageEvent(message, signature);
        return mockedReceiveMessageResult;
    }

    function mockReceiveMessageResult(bool _value) external {
        mockedReceiveMessageResult = _value;
    }
}
