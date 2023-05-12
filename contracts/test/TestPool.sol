// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Pool} from "../Pool.sol";
import {RewardManager} from "../RewardManager.sol";

contract TestPool is Pool {
    constructor(
        address _router,
        uint _a,
        ERC20 _token,
        uint16 _feeShareBP,
        uint _balanceRatioMinBP
    ) Pool(_router, _a, _token, _feeShareBP, _balanceRatioMinBP, "LP", "LP") {}

    function setVUsdBalance(uint _vUsdBalance) public {
        vUsdBalance = _vUsdBalance;
    }

    function setTokenBalance(uint _tokenBalance) public {
        tokenBalance = _tokenBalance;
    }
}
