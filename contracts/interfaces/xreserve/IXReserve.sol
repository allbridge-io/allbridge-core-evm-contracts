// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title IXReserve
 * @notice Interface for Circle's xReserve DepositToRemote contract
 */
interface IXReserve {
    /**
     * @notice Deposits and burns tokens from sender to be minted on destination domain.
     * @param value amount of tokens to burn
     * @param remoteDomain destination domain
     * @param remoteRecipient address of mint recipient on destination domain
     * @param localToken address of contract to burn deposited tokens, on local domain
     * @param maxFee maximum fee for the relayer
     * @param hookData data for the hook
     */
    function depositToRemote(
        uint256 value,
        uint32 remoteDomain,
        bytes32 remoteRecipient,
        address localToken,
        uint256 maxFee,
        bytes calldata hookData
    ) external;
}
