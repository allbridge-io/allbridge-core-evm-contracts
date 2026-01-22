// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockOftBridge {
    uint private mockedRelayerFee = 30000;

    event BridgeEvent(
        address tokenAddress,
        uint amount,
        bytes32 recipient,
        uint destinationChainId,
        uint relayerFeeTokenAmount,
        uint extraGasInDestinationToken,
        uint slippageBP,
        uint value
    );

    function bridge(
        address _tokenAddress,
        uint _amount,
        bytes32 _recipient,
        uint _destinationChainId,
        uint _relayerFeeTokenAmount,
        uint _extraGasInDestinationToken,
        uint _slippageBP
    ) public payable {
        IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount);
        emit BridgeEvent(
            _tokenAddress,
            _amount,
            _recipient,
            _destinationChainId,
            _relayerFeeTokenAmount,
            _extraGasInDestinationToken,
            _slippageBP,
            msg.value
        );
    }

    function relayerFee(address _tokenAddress, uint _destinationChainId, uint _amount) external view returns (uint) {
        return mockedRelayerFee;
    }

    function mockRelayerFee(uint _value) external {
        mockedRelayerFee = _value;
    }
}
