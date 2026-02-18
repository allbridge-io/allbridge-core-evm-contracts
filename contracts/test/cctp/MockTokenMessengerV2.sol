// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ITokenMessengerV2} from "../../interfaces/cctp/ITokenMessengerV2.sol";

contract MockTokenMessengerV2 is ITokenMessengerV2 {
    event DepositForBurnEvent(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    );

    function depositForBurn(
        uint256 amount,
        uint32 destinationDomain,
        bytes32 mintRecipient,
        address burnToken,
        bytes32 destinationCaller,
        uint256 maxFee,
        uint32 minFinalityThreshold
    ) external {
        emit DepositForBurnEvent(
            amount,
            destinationDomain,
            mintRecipient,
            burnToken,
            destinationCaller,
            maxFee,
            minFinalityThreshold
        );
    }
}
