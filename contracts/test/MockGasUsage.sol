// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IGasOracle} from "../interfaces/IGasOracle.sol";

// Uncomment this line to use console.log
//import "hardhat/console.sol";

/**
 * @dev Contract module which allows children to store typical gas usage of a certain transaction on another chain.
 */
abstract contract MockGasUsage is Ownable {
    mapping(uint chainId => uint amount) public gasUsage;
    uint private mockedTransactionCost = 10000;

    function setGasUsage(uint chainId, uint gasAmount) external onlyOwner {
        gasUsage[chainId] = gasAmount;
    }

    function getTransactionCost(uint chainId) external view returns (uint) {
        return mockedTransactionCost;
    }

    function mockTransactionCost(uint _value) external {
        mockedTransactionCost = _value;
    }
}
