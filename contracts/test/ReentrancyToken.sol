// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../Pool.sol";

contract ReentrancyToken is ERC20 {
    uint8 internal _decimals;
    bool internal reentrancy;
    Pool pool;

    constructor(string memory _name, string memory _symbol, uint _amount, uint8 __decimals) ERC20(_name, _symbol) {
        _mint(msg.sender, _amount);
        _decimals = __decimals;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    function transfer(address to, uint256 amount) public virtual override returns (bool) {
        bool result = ERC20.transfer(to, amount);
        if (reentrancy) {
            pool.claimRewards();
        }
        return result;
    }

    function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
        bool result = ERC20.transferFrom(from, to, amount);
        if (reentrancy) {
            pool.claimRewards();
        }
        return result;
    }

    function setPool(Pool pool_) public {
        pool = pool_;
    }

    function useAttack(bool reentrancy_) public {
        reentrancy = reentrancy_;
    }
}
