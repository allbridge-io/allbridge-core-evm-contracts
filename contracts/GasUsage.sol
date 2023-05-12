// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGasOracle} from "./interfaces/IGasOracle.sol";

/**
 * @dev Contract module which allows children to store typical gas usage of a certain transaction on another chain.
 */
abstract contract GasUsage is Ownable {
    IGasOracle internal gasOracle;
    mapping(uint chainId => uint amount) public gasUsage;

    constructor(IGasOracle _gasOracle) {
        gasOracle = _gasOracle;
    }

    /**
     * @dev Sets the amount of gas used for a transaction on a given chain.
     * @param chainId The ID of the chain.
     * @param gasAmount The amount of gas used on the chain.
     */
    function setGasUsage(uint chainId, uint gasAmount) external onlyOwner {
        gasUsage[chainId] = gasAmount;
    }

    /**
     * @dev Sets the Gas Oracle contract address.
     * @param _gasOracle The address of the Gas Oracle contract.
     */
    function setGasOracle(IGasOracle _gasOracle) external onlyOwner {
        gasOracle = _gasOracle;
    }

    /**
     * @notice Get the gas cost of a transaction on another chain in the current chain's native token.
     * @param chainId The ID of the chain for which to get the gas cost.
     * @return The calculated gas cost of the transaction in the current chain's native token
     */
    function getTransactionCost(uint chainId) external view returns (uint) {
        unchecked {
            return gasOracle.getTransactionGasCostInNativeToken(chainId, gasUsage[chainId]);
        }
    }
}
