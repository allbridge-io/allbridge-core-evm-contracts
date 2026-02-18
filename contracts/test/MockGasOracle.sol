// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

// Uncomment this line to use console.log
//import "hardhat/console.sol";

contract MockGasOracle {
    mapping(uint => uint) public prices;

    uint public mockedTransactionGasCostInNativeToken;

    function price(uint chainId) external view returns (uint) {
        return prices[chainId];
    }

    function setPrice(uint chainId, uint _price) external {
        prices[chainId] = _price;
    }

    function getTransactionGasCostInNativeToken(uint otherChainId, uint gasAmount) external view returns (uint) {
        return mockedTransactionGasCostInNativeToken;
    }

    function mockTransactionGasCostInNativeToken(uint value) external {
        mockedTransactionGasCostInNativeToken = value;
    }
}
