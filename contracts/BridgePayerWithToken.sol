// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ICctpBridge} from "./interfaces/ICctpBridge.sol";
import {IMessengerGateway} from "./interfaces/IMessengerGateway.sol";
import {MessengerProtocol, IBridge} from "./interfaces/IBridge.sol";
import {GasUsage} from "./GasUsage.sol";
import {OftBridge} from "./OftBridge.sol";

// Uncomment this line to use console.log
//import "hardhat/console.sol";

contract BridgePayerWithToken is Ownable {
    using SafeERC20 for IERC20Metadata;
    using SafeERC20 for IERC20;

    IERC20Metadata public abrToken;
    address private cctpToken;
    address public bridge;
    address public cctpBridge;
    address public cctpV2Bridge;
    address payable public oftBridge;

    uint private constant EXCHANGE_RATE_PRECISION = 18;
    /**
     * Exchange rate: ABR tokens per native tokens with decimals EXCHANGE_RATE_PRECISION
     */
    uint public exchangeRate;
    uint private immutable conversionScalingFactor;

    constructor(address _abrTokenAddress, uint _chainPrecision, address _bridgeAddress) {
        bridge = _bridgeAddress;
        abrToken = IERC20Metadata(_abrTokenAddress);
        uint abrTokenDecimals = abrToken.decimals();
        conversionScalingFactor = 10 ** (EXCHANGE_RATE_PRECISION + _chainPrecision - abrTokenDecimals);
    }

    /**
     * @notice Bridge stable tokens using ABR for bridging fee.
     */
    function swapAndBridge(
        bytes32 _token,
        uint _amount,
        bytes32 _recipient,
        uint _destinationChainId,
        bytes32 _receiveToken,
        uint _nonce,
        MessengerProtocol _messenger,
        uint _feeAbrAmount
    ) external payable {
        // charge bridging fee in ABR
        uint nativeAmount = _coverBridgingFee(_feeAbrAmount);

        // transfer the tokens to bridge
        IERC20(address(uint160(uint256(_token)))).safeTransferFrom(msg.sender, address(this), _amount);

        IBridge(bridge).swapAndBridge{value: nativeAmount}(
            _token,
            _amount,
            _recipient,
            _destinationChainId,
            _receiveToken,
            _nonce,
            _messenger,
            0
        );
    }

    function bridgeCctp(
        uint _amount,
        bytes32 _recipient,
        uint _destinationChainId,
        MessengerProtocol _messenger,
        uint _feeAbrAmount
    ) external payable {
        // charge bridging fee in ABR
        uint nativeAmount = _coverBridgingFee(_feeAbrAmount);

        // transfer the tokens to bridge
        IERC20(cctpToken).safeTransferFrom(msg.sender, address(this), _amount);

        ICctpBridge bridgeContract;
        if (_messenger == MessengerProtocol.CCTP) {
            bridgeContract = ICctpBridge(cctpBridge);
        } else if (_messenger == MessengerProtocol.CCTPv2) {
            bridgeContract = ICctpBridge(cctpV2Bridge);
        }
        bridgeContract.bridge{value: nativeAmount}(_amount, _recipient, _destinationChainId, 0);
    }

    function bridgeOft(
        address _token,
        uint _amount,
        bytes32 _recipient,
        uint _destinationChainId,
        uint _extraGasInDestinationToken,
        uint _slippageBP,
        uint _feeAbrAmount
    ) external payable {
        // charge bridging fee in ABR
        uint nativeAmount = _coverBridgingFee(_feeAbrAmount);

        // transfer the tokens to bridge
        IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);

        OftBridge(oftBridge).bridge{value: nativeAmount}(
            _token,
            _amount,
            _recipient,
            _destinationChainId,
            0,
            _extraGasInDestinationToken,
            _slippageBP
        );
    }

    /**
     * @notice Get ABR amount enough to pay the bridging fee.
     */
    function getBridgeFeeInAbr(
        uint _destinationChainId,
        MessengerProtocol _messenger,
        address _token,
        uint _amount
    ) external view returns (uint) {
        // native token amount enough to pay the bridging fee.
        uint amountNative;
        if (_messenger == MessengerProtocol.Allbridge || _messenger == MessengerProtocol.Wormhole) {
            amountNative =
                IMessengerGateway(bridge).getMessageCost(_destinationChainId, _messenger) +
                GasUsage(bridge).getTransactionCost(_destinationChainId);
        } else if (_messenger == MessengerProtocol.CCTP) {
            amountNative = GasUsage(cctpBridge).getTransactionCost(_destinationChainId);
        } else if (_messenger == MessengerProtocol.CCTPv2) {
            amountNative = GasUsage(cctpV2Bridge).getTransactionCost(_destinationChainId);
        } else if (_messenger == MessengerProtocol.LayerZero) {
            amountNative = OftBridge(oftBridge).relayerFee(_token, _destinationChainId, _amount);
        } else {
            revert("Payer: Not supported messenger");
        }
        return _nativeTokensToAbr(amountNative);
    }

    /**
     * @dev Set the exchange rate of ABR per gas token with decimals EXCHANGE_RATE_PRECISION.
     */
    function setExchangeRate(uint _newExchangeRate) external onlyOwner {
        exchangeRate = _newExchangeRate;
    }

    function setBridge(address _bridge) external onlyOwner {
        bridge = _bridge;
    }

    function setCctpBridge(address _bridge, address _token) external onlyOwner {
        cctpBridge = _bridge;
        cctpToken = _token;
    }

    function setCctpV2Bridge(address _bridge, address _token) external onlyOwner {
        cctpV2Bridge = _bridge;
        cctpToken = _token;
    }

    function setOftBridge(address _bridge) external onlyOwner {
        oftBridge = payable(_bridge);
    }

    function approveBridgeToken(address _tokenAddress) external onlyOwner {
        IERC20(_tokenAddress).safeApprove(bridge, type(uint256).max);
    }

    /**
     * @notice Withdraw gas tokens.
     */
    function withdrawGas(uint amount) external onlyOwner {
        payable(msg.sender).transfer(amount);
    }

    /**
     * @notice Withdraw the tokens.
     */
    function withdrawTokens(address tokenAddress) external onlyOwner {
        IERC20 token = IERC20(tokenAddress);
        uint toWithdraw = token.balanceOf(address(this));
        if (toWithdraw > 0) {
            token.safeTransfer(msg.sender, toWithdraw);
        }
    }

    function _coverBridgingFee(uint _feeAbrAmount) internal returns (uint) {
        abrToken.safeTransferFrom(msg.sender, address(this), _feeAbrAmount);
        return msg.value + _abrToNativeTokens(_feeAbrAmount);
    }

    /**
     * @dev Calculate ABR amount from native tokens based on exchange rate
     */
    function _nativeTokensToAbr(uint _amount) internal view returns (uint) {
        return (_amount * exchangeRate) / conversionScalingFactor;
    }

    /**
     * @dev Calculate native token amount from ABR tokens based on exchange rate
     */
    function _abrToNativeTokens(uint _abrAmount) internal view returns (uint) {
        return (_abrAmount * conversionScalingFactor) / exchangeRate;
    }

    receive() external payable {}

    fallback() external payable {
        revert("Unsupported");
    }
}
