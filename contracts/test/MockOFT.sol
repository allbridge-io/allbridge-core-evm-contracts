import {UlnOptions} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/uln/libs/UlnOptions.sol";
import {ExecutorOptions} from "@layerzerolabs/lz-evm-messagelib-v2/contracts/libs/ExecutorOptions.sol";
import {MockERC20} from "./MockERC20.sol";
import {
    SendParam,
    MessagingFee,
    MessagingReceipt,
    OFTReceipt
} from "@layerzerolabs/oft-evm/contracts/interfaces/IOFT.sol";

// SPDX-License-Identifier: MIT
contract MockOFT {
    using ExecutorOptions for bytes;
    address public token;
    uint public defaultNativeFee = 10000000000000000;

    constructor(address _token) {
        token = _token;
    }

    function setDefaultNativeFee(uint fee) external {
        defaultNativeFee = fee;
    }

    function quoteSend(SendParam calldata sendParam, bool payInLzToken) external view returns (MessagingFee memory) {
        // Calculate fee based on options - in real implementation this would parse the options
        uint fee = defaultNativeFee;
        bytes calldata _options = sendParam.extraOptions[2:];

        uint256 cursor = 0;
        while (cursor < _options.length) {
            (uint8 optionType, bytes calldata option, uint256 newCursor) = _options.nextExecutorOption(cursor);
            cursor = newCursor;
            if (optionType == ExecutorOptions.OPTION_TYPE_NATIVE_DROP) {
                (uint128 nativeDropAmount, ) = ExecutorOptions.decodeNativeDropOption(option);
                fee += nativeDropAmount;
            }
        }

        return MessagingFee({nativeFee: fee, lzTokenFee: 0});
    }

    function send(
        SendParam calldata sendParam,
        MessagingFee calldata fee,
        address refundAddress
    ) external payable returns (MessagingReceipt memory, OFTReceipt memory) {
        require(msg.value >= fee.nativeFee, "Not enough native token for fee");

        // Simulate the token transfer
        MockERC20(token).transferFrom(msg.sender, address(this), sendParam.amountLD);
        return (MessagingReceipt(bytes32(0), 0, MessagingFee(0, 0)), OFTReceipt(0, 0));
    }
}
