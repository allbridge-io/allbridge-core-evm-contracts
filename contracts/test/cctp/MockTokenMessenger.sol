// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ITokenMessenger} from "../../interfaces/cctp/ITokenMessenger.sol";

contract MockTokenMessenger is ITokenMessenger {
    uint64 private mockedDepositForBurnResult;

    event DepositForBurnEvent(
        uint amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    );

    event ReplaceDepositForBurnEvent(
        bytes originalMessage,
        bytes originalAttestation,
        bytes32 newDestinationCaller,
        bytes32 newMintRecipient
    );

    function depositForBurn(
        uint amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken
    ) external returns (uint64 _nonce) {
        emit DepositForBurnEvent(
            amount,
            destinationDomain,
            mintRecipient,
            burnToken
        );
        return mockedDepositForBurnResult;
    }

    function replaceDepositForBurn(
        bytes calldata originalMessage,
        bytes calldata originalAttestation,
        bytes32 newDestinationCaller,
        bytes32 newMintRecipient
    ) external {
        emit ReplaceDepositForBurnEvent(
            originalMessage,
            originalAttestation,
            newDestinationCaller,
            newMintRecipient
        );
    }

    function mockDepositForBurnResult(uint64 _value) external {
        mockedDepositForBurnResult = _value;
    }
}
