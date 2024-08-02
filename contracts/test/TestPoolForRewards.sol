// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {RewardManager} from "../RewardManager.sol";

contract TestPoolForRewards is RewardManager {
    // solhint-disable-next-line no-empty-blocks
    constructor(ERC20 token) RewardManager(token, "LP", "LP") {}

    function deposit(uint amount) extraAmountRewards(0) external {
        _depositLp(msg.sender, amount);
    }

    function withdraw(uint amount) extraAmountRewards(0) external {
        _withdrawLp(msg.sender, amount);
    }

    function addRewards(uint amount) extraAmountRewards(0) external {
        _addRewards(amount);
    }
}
