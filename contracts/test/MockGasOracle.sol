// SPDX-License-Identifier: MIT
contract MockGasOracle {
    mapping(uint => uint) public prices;

    function price(uint chainId) external view returns (uint) {
        return prices[chainId];
    }

    function setPrice(uint chainId, uint _price) external {
        prices[chainId] = _price;
    }
}
