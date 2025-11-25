// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {MessengerProtocol} from "./IBridge.sol";

interface ICctpBridge {
    function chainId() external view returns (uint);

    function adminFeeShareBP() external view returns (uint);

    function getBridgingCostInTokens(
        uint destinationChainId,
        MessengerProtocol messenger,
        address tokenAddress
    ) external view returns (uint);

    function bridge(
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        uint relayerFeeTokenAmount
    ) external payable;

    function bridgeWithWalletAddress(
        uint amount,
        bytes32 recipient,
        bytes32 recipientWalletAddress,
        uint destinationChainId,
        uint relayerFeeTokenAmount
    ) external payable;
}
