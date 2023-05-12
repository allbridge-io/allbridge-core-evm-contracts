// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {RewardManager} from "../RewardManager.sol";

contract TestPoolForRewards is RewardManager {
    // solhint-disable-next-line no-empty-blocks
    constructor(ERC20 _token) RewardManager(_token, "LP", "LP") {}

    function deposit(uint _amount) external {
        _depositLp(msg.sender, _amount);
    }

    function withdraw(uint _amount) external {
        _withdrawLp(msg.sender, _amount);
    }

    function addRewards(uint _amount) external {
        _addRewards(_amount);
    }
}
