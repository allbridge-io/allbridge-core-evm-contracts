// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

abstract contract Stoppable is Ownable {
    uint public isStopped = 0;
    address private stopAuthority;

    constructor() {
        stopAuthority = owner();
    }

    /**
     * @dev Modifier to make a function callable only when the contract is not stopped.
     */
    modifier whenNotStopped() {
        require(isStopped == 0, "Stoppable: stopped");
        _;
    }

    /**
     * @dev Throws if called by any account other than the stopAuthority.
     */
    modifier onlyStopAuthority() {
        require(stopAuthority == msg.sender, "Stoppable: is not stopAuthority");
        _;
    }

    /**
     * @dev Triggers stopped state.
     */
    function stop() external onlyStopAuthority {
        isStopped = 1;
    }

    /**
     * @dev Returns to normal state.
     */
    function start() external onlyOwner {
        isStopped = 0;
    }

    /**
     * @dev Allows the admin to set the address of the stopAuthority.
     */
    function setStopAuthority(address newStopAuthority) external onlyOwner {
        require(newStopAuthority != address(0), "Stoppable: zero address");
        stopAuthority = newStopAuthority;
    }
}
