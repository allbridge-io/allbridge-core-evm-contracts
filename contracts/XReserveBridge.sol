// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IXReserve} from "./interfaces/xreserve/IXReserve.sol";

contract XReserveBridge is Ownable {
    using SafeERC20 for IERC20Metadata;

    uint internal constant BP = 1e4;
    uint internal constant MAX_FEE_SHARE_P = 1e9;

    uint public immutable chainId;
    // Admin fee share (in basis points)
    uint public adminFeeShareBP;
    uint public maxFeeShare = 0;
    IERC20Metadata private immutable token;
    IXReserve private immutable xReserve;

    mapping(uint chainId => uint domainNumber) private chainIdDomainMap;

    /**
     * @notice Emitted when tokens are sent on the source blockchain.
     */
    event XReserveTokensSent(
        address sender,
        bytes32 recipient,
        uint amount,
        uint destinationChainId,
        uint adminFeeTokenAmount,
        uint maxFee
    );

    constructor(
        uint chainId_,
        address tokenAddress,
        address xReserve_
    ) {
        chainId = chainId_;
        token = IERC20Metadata(tokenAddress);
        xReserve = IXReserve(xReserve_);
        token.approve(xReserve_, type(uint256).max);
    }

    /**
     * @notice Initiates a bridging process of the token to another blockchain via xReserve.
     * @param amount The amount of tokens to send.
     * @param recipient The recipient address.
     * @param destinationChainId The ID of the destination chain.
     */
    function bridge(
        uint amount,
        bytes32 recipient,
        uint destinationChainId
    ) public {
        require(amount > 0, "XRB: Amount must be greater than zero");
        require(recipient != 0, "XRB: Recipient must be nonzero");
        token.safeTransferFrom(msg.sender, address(this), amount);
        uint amountToSend = amount;
        uint adminFee;
        if (adminFeeShareBP != 0) {
            adminFee = (amount * adminFeeShareBP) / BP;
            if (adminFee == 0) {
                adminFee = 1;
            }
            amountToSend -= adminFee;
        }
        uint32 destinationDomain = getDomainByChainId(destinationChainId);
        uint maxFee = (amountToSend * maxFeeShare) / MAX_FEE_SHARE_P + 1;
        xReserve.depositToRemote(
            amountToSend,
            destinationDomain,
            recipient,
            address(token),
            maxFee,
            ""
        );
        emit XReserveTokensSent(
            msg.sender,
            recipient,
            amount,
            destinationChainId,
            adminFee,
            maxFee
        );
    }

    /**
     * @notice Allows the admin to add new supported chain destination.
     * @param chainId_ The chain ID of the destination to register.
     * @param domain The domain of the destination to register.
     */
    function registerBridgeDestination(uint chainId_, uint32 domain) external onlyOwner {
        chainIdDomainMap[chainId_] = domain;
    }

    /**
     * @notice Allows the admin to remove a chain from the map of supported destinations.
     * @param chainId_ The chain ID of the destination to unregister.
     */
    function unregisterBridgeDestination(uint chainId_) external onlyOwner {
        chainIdDomainMap[chainId_] = 0;
    }

    /**
     * @notice Allows the admin to withdraw the admin fee collected in tokens.
     */
    function withdrawFeeInTokens() external onlyOwner {
        uint toWithdraw = token.balanceOf(address(this));
        if (toWithdraw > 0) {
            token.safeTransfer(msg.sender, toWithdraw);
        }
    }

    /**
     * @notice Sets the basis points of the admin fee share from each bridge.
     */
    function setAdminFeeShare(uint adminFeeShareBP_) external onlyOwner {
        require(adminFeeShareBP_ <= BP, "XRB: Too high");
        adminFeeShareBP = adminFeeShareBP_;
    }

    /**
     * @notice Sets the maximum fee share for the relayer.
     */
    function setMaxFeeShare(uint maxFeeShare_) external onlyOwner {
        require(maxFeeShare_ <= MAX_FEE_SHARE_P, "XRB: Too high");
        maxFeeShare = maxFeeShare_;
    }

    function getDomainByChainId(uint chainId_) public view returns (uint32) {
        uint domainNumber = chainIdDomainMap[chainId_];
        require(domainNumber > 0, "XRB: Unknown chain id");
        return uint32(domainNumber);
    }

    fallback() external payable {
        revert("Unsupported");
    }

    receive() external payable {
        revert("Direct native token deposits not supported");
    }
}
