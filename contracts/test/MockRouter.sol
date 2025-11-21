// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IBridge, MessengerProtocol} from "../interfaces/IBridge.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockRouter is Ownable {
    mapping(bytes32 tokenId => address) public pools;

    constructor() {}

    function addPool(address pool, bytes32 _token) external onlyOwner {
        pools[_token] = pool;
    }
}
