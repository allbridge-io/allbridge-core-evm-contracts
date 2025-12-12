// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import {IBridge, MessengerProtocol} from "./interfaces/IBridge.sol";
import {Router} from "./Router.sol";
import {AutoDepositFactory} from "./AutoDepositFactory.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract AutoDepositWallet is Initializable {
    using SafeERC20 for IERC20Metadata;

    address payable public immutable factory;
    /**
     * @notice Bridge contract address.
     */
    address public bridge;

    /**
     * @notice Bridging destination chain ID where deposited tokens can be bridged to.
     */
    uint public recipientChainId;

    /**
     * @notice Bridging destination address where deposited tokens can be bridged to.
     */
    bytes32 public recipient;

    /**
     * @notice Bridging destination token to which deposited tokens can be swapped to.
     */
    bytes32 public recipientToken;

    /**
     * @notice Min token amount that can be bridged in one call.
     * @dev Amount with 0 decimals.
     */
    uint public minDepositAmount;

    /**
     * @notice Wallet accepts deposits only in supported tokens. Stores min token amount that can be bridged in one call.
     * @dev Amount in token decimals.
     */
    mapping(address tokenAddress => uint minDepositAmount) public minDepositTokenAmount;

    modifier onlyFactory() {
        require(address(factory) == msg.sender, "ADW: caller is not the factory");
        _;
    }

    modifier onlyFactoryOwner() {
        require(Ownable(factory).owner() == msg.sender, "ADW: caller is not the factory owner");
        _;
    }

    constructor() {
        factory = payable(msg.sender);
    }

    function initialize(
        uint _recipientChainId,
        address _bridge,
        bytes32 _recipient,
        bytes32 _recipientToken,
        uint _minDepositAmount
    ) public initializer {
        recipientChainId = _recipientChainId;
        bridge = _bridge;
        recipient = _recipient;
        recipientToken = _recipientToken;
        require(_minDepositAmount > 0, "ADW: minDepositAmount is not set");
        minDepositAmount = _minDepositAmount;
    }

    function isTokenRegistered(address _token) public view returns (bool) {
        return minDepositTokenAmount[_token] != 0;
    }

    function registerToken(address _token) external {
        _registerToken(_token);
    }

    function registerTokens(address[] calldata _tokens) external {
        for (uint i = 0; i < _tokens.length; i++) {
            _registerToken(_tokens[i]);
        }
    }

    function swapAndBridge(address _token, uint _nonce, MessengerProtocol _messenger) external {
        uint amountSource = IERC20Metadata(_token).balanceOf(address(this));
        uint minAmount = minDepositTokenAmount[_token];
        if (minAmount == 0) {
            minAmount = _registerToken(_token);
        }
        require(amountSource >= minAmount, "ADW: amount too low");
        _swapAndBridge(_token, amountSource, _nonce, _messenger);
    }

    function factorySwapAndBridge(address _token, uint _amount, uint _nonce, MessengerProtocol _messenger) external onlyFactory {
        _swapAndBridge(_token, _amount, _nonce, _messenger);
    }

    function _swapAndBridge(address _token, uint _amount, uint _nonce, MessengerProtocol _messenger) internal  {
        IBridge(bridge).swapAndBridge(
            bytes32(uint(uint160(_token))),
            _amount,
            recipient,
            recipientChainId,
            recipientToken,
            _nonce,
            _messenger,
            IBridge(bridge).getBridgingCostInTokens(recipientChainId, _messenger, _token) + 1
        );
    }

    /**
     * @dev Transfer unsupported tokens.
     */
    function transferUnsupportedToken(address _token, address _recipient) onlyFactoryOwner external {
        // Check that bridging of the token is not supported
        require(
            address(Router(bridge).pools(bytes32(uint(uint160(_token))))) == address(0),
            "ADW: bridging is supported"
        );

        uint amount = IERC20Metadata(_token).balanceOf(address(this));
        if (amount > 0) {
            IERC20Metadata(_token).safeTransfer(_recipient, amount);
        }
    }

    function _registerToken(address _tokenAddress) internal returns (uint minAmount) {
        IERC20Metadata(_tokenAddress).safeApprove(bridge, type(uint256).max);
        IERC20Metadata(_tokenAddress).safeApprove(factory, type(uint256).max);
        uint tokenDecimals = IERC20Metadata(_tokenAddress).decimals();
        minAmount = minDepositAmount * 10 ** tokenDecimals;
        minDepositTokenAmount[_tokenAddress] = minAmount;
    }

    fallback() external {
        revert("Unsupported");
    }
}
