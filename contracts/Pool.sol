// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {RewardManager} from "./RewardManager.sol";

/**
 * 4AD - D = 4A(x + y) - (D³ / 4xy)
 * X - is value of real stable token
 * Y - is value of virtual usd
 */
contract Pool is RewardManager {
    using SafeERC20 for ERC20;
    uint private constant SYSTEM_PRECISION = 3;
    int private constant PP = 1e4; // Price Precision
    uint private constant BP = 10000; // Basis Points
    uint private constant MAX_TOKEN_BALANCE = 2 ** 40; // Max possible token balance

    /**
     * @dev Gas optimization: both the 'feeShareBP' and 'router' fields are used during the 'swapFromVUsd', 'swapToVUsd'
     * operations and can occupy the same slot.
     */
    uint16 public feeShareBP;
    address public router;
    uint public tokenBalance;
    uint public vUsdBalance;
    uint public balanceRatioMinBP;
    uint public reserves;
    uint public immutable a;
    uint public d;

    uint private immutable tokenAmountReduce;
    uint private immutable tokenAmountIncrease;

    // can restrict deposit or withdraw operations
    address private stopAuthority;
    // is deposit operation allowed
    uint public canDeposit = 1;
    // is withdraw operation allowed
    uint public canWithdraw = 1;

    event SwappedToVUsd(address sender, address token, uint amount, uint vUsdAmount, uint fee);
    event SwappedFromVUsd(address recipient, address token, uint vUsdAmount, uint amount, uint fee);

    constructor(
        address _router,
        uint _a,
        ERC20 _token,
        uint16 _feeShareBP,
        uint _balanceRatioMinBP,
        string memory lpName,
        string memory lpSymbol
    ) RewardManager(_token, lpName, lpSymbol) {
        a = _a;
        router = _router;
        stopAuthority = owner();
        feeShareBP = _feeShareBP;
        balanceRatioMinBP = _balanceRatioMinBP;

        uint decimals = _token.decimals();
        tokenAmountReduce = decimals > SYSTEM_PRECISION ? 10 ** (decimals - SYSTEM_PRECISION) : 0;
        tokenAmountIncrease = decimals < SYSTEM_PRECISION ? 10 ** (SYSTEM_PRECISION - decimals) : 0;
    }

    /**
     * @dev Throws if called by any account other than the router.
     */
    modifier onlyRouter() {
        require(router == msg.sender, "Pool: is not router");
        _;
    }

    /**
     * @dev Throws if called by any account other than the stopAuthority.
     */
    modifier onlyStopAuthority() {
        require(stopAuthority == msg.sender, "Pool: is not stopAuthority");
        _;
    }

    /**
     * @dev Modifier to prevent function from disbalancing the pool over a threshold defined by `balanceRatioMinBP`
     */
    modifier validateBalanceRatio() {
        _;
        if (tokenBalance > vUsdBalance) {
            require((vUsdBalance * BP) / tokenBalance >= balanceRatioMinBP, "Pool: low vUSD balance");
        } else if (tokenBalance < vUsdBalance) {
            require((tokenBalance * BP) / vUsdBalance >= balanceRatioMinBP, "Pool: low token balance");
        }
    }

    /**
     * @dev Modifier to make a function callable only when the deposit is allowed.
     */
    modifier whenCanDeposit() {
        require(canDeposit == 1, "Pool: deposit prohibited");
        _;
    }

    /**
     * @dev Modifier to make a function callable only when the withdraw is allowed.
     */
    modifier whenCanWithdraw() {
        require(canWithdraw == 1, "Pool: withdraw prohibited");
        _;
    }

    /**
     * @dev Calculates the price and deposit token according to the amount and price, then adds the same amount to the X
     * and to the Y
     * @param amount The deposited amount
     */
    function deposit(uint amount) external whenCanDeposit {
        uint oldD = d;

        uint amountSP = _toSystemPrecision(amount);
        require(amountSP > 0, "Pool: too little");

        token.safeTransferFrom(msg.sender, address(this), amount);

        // Add deposited amount to reserves
        reserves += amountSP;

        uint oldBalance = (tokenBalance + vUsdBalance);
        if (oldD == 0 || oldBalance == 0) {
            // Split balance equally on the first deposit
            uint halfAmount = amountSP >> 1;
            tokenBalance += halfAmount;
            vUsdBalance += halfAmount;
        } else {
            // Add amount proportionally to each pool
            tokenBalance += (amountSP * tokenBalance) / oldBalance;
            vUsdBalance += (amountSP * vUsdBalance) / oldBalance;
        }
        _updateD();
        // Deposit as many LP tokens as the D increase
        _depositLp(msg.sender, d - oldD);

        require(tokenBalance < MAX_TOKEN_BALANCE, "Pool: too much");
    }

    /*
     * @dev Subtracts X and Y for that amount, calculates current price and withdraw the token to the user according to
     * the price
     * @param amount The deposited amount
     */
    function withdraw(uint amountLp) external whenCanWithdraw {
        uint oldD = d;
        _withdrawLp(msg.sender, amountLp);

        // Always withdraw tokens in amount equal to amountLp

        // Withdraw proportionally from token and vUsd balance
        uint oldBalance = (tokenBalance + vUsdBalance);
        tokenBalance -= (amountLp * tokenBalance) / oldBalance;
        vUsdBalance -= (amountLp * vUsdBalance) / oldBalance;

        require(tokenBalance + vUsdBalance < oldBalance, "Pool: zero changes");

        // Check if there is enough funds in reserve to withdraw
        require(amountLp <= reserves, "Pool: reserves");

        // Adjust reserves by withdraw amount
        reserves -= amountLp;

        // Update D and transfer tokens to the sender
        _updateD();
        require(d < oldD, "Pool: zero D changes");

        token.safeTransfer(msg.sender, _fromSystemPrecision(amountLp));
    }

    /**
     * @notice Calculates new virtual USD value from the given amount of tokens.
     * @dev Calculates new Y according to new X.
     * NOTICE: Prior to calling this the router must transfer tokens from the user to the pool.
     * @param amount The amount of tokens to swap.
     * @param zeroFee When true it allows to swap without incurring any fees. It is intended for use with service
     * accounts.
     * @return returns the difference between the old and the new value of vUsdBalance
     */
    function swapToVUsd(
        address user,
        uint amount,
        bool zeroFee
    ) external onlyRouter validateBalanceRatio returns (uint) {
        uint result; // 0 by default
        uint fee;
        if (amount > 0) {
            if (!zeroFee) {
                fee = (amount * feeShareBP) / BP;
            }
            uint amountIn = _toSystemPrecision(amount - fee);
            // Incorporate rounding dust into the fee
            fee = amount - _fromSystemPrecision(amountIn);

            // Adjust token and reserve balances after the fee is applied
            tokenBalance += amountIn;
            reserves += amountIn;

            uint vUsdNewAmount = this.getY(tokenBalance);
            if (vUsdBalance > vUsdNewAmount) {
                result = vUsdBalance - vUsdNewAmount;
            }
            vUsdBalance = vUsdNewAmount;
            _addRewards(fee);
        }

        emit SwappedToVUsd(user, address(token), amount, result, fee);
        return result;
    }

    /**
     * @notice Calculates the amount of tokens from the given virtual USD value, and transfers it to the user.
     * @dev Calculates new X according to new Y.
     * @param user The address of the recipient.
     * @param amount The amount of vUSD to swap.
     * @param receiveAmountMin The minimum amount of tokens required to be received during the swap, otherwise the
     * transaction reverts.
     * @param zeroFee When true it allows to swap without incurring any fees. It is intended for use with service
     * accounts.
     * @return returns the difference between the old and the new value of vUsdBalance
     */
    function swapFromVUsd(
        address user,
        uint amount,
        uint receiveAmountMin,
        bool zeroFee
    ) external onlyRouter validateBalanceRatio returns (uint) {
        uint resultSP; // 0 by default
        uint result; // 0 by default
        uint fee;
        if (amount > 0) {
            vUsdBalance += amount;
            uint newAmount = this.getY(vUsdBalance);
            if (tokenBalance > newAmount) {
                resultSP = tokenBalance - newAmount;
                result = _fromSystemPrecision(resultSP);
            } // Otherwise result/resultSP stay 0

            // Check if there is enough funds in reserve to pay
            require(resultSP <= reserves, "Pool: reserves");
            // Remove from reserves including fee, apply fee later
            reserves -= resultSP;
            if (!zeroFee) {
                fee = (result * feeShareBP) / BP;
            }
            // We can use unchecked here because feeShareBP <= BP
            unchecked {
                result -= fee;
            }

            tokenBalance = newAmount;
            require(result >= receiveAmountMin, "Pool: slippage");
            token.safeTransfer(user, result);
            _addRewards(fee);
        }
        emit SwappedFromVUsd(user, address(token), amount, result, fee);
        return result;
    }

    /**
     * @dev Sets admin fee share.
     */
    function setFeeShare(uint16 _feeShareBP) external onlyOwner {
        require(_feeShareBP <= BP, "Pool: too large");
        feeShareBP = _feeShareBP;
    }

    function adjustTotalLpAmount() external onlyOwner {
        if (d > totalSupply()) {
            _depositLp(owner(), d - totalSupply());
        }
    }

    /**
     * @dev Sets the threshold over which the pool can't be disbalanced.
     */
    function setBalanceRatioMinBP(uint _balanceRatioMinBP) external onlyOwner {
        require(_balanceRatioMinBP <= BP, "Pool: too large");
        balanceRatioMinBP = _balanceRatioMinBP;
    }

    /**
     * @dev Switches off the possibility to make deposits.
     */
    function stopDeposit() external onlyStopAuthority {
        canDeposit = 0;
    }

    /**
     * @dev Switches on the possibility to make deposits.
     */
    function startDeposit() external onlyOwner {
        canDeposit = 1;
    }

    /**
     * @dev Switches off the possibility to make withdrawals.
     */
    function stopWithdraw() external onlyStopAuthority {
        canWithdraw = 0;
    }

    /**
     * @dev Switches on the possibility to make withdrawals.
     */
    function startWithdraw() external onlyOwner {
        canWithdraw = 1;
    }

    /**
     * @dev Sets the address of the stopAuthority account.
     */
    function setStopAuthority(address _stopAuthority) external onlyOwner {
        stopAuthority = _stopAuthority;
    }

    /**
     * @dev Sets the address of the Router contract.
     */
    function setRouter(address _router) external onlyOwner {
        router = _router;
    }

    /**
     * @dev y = (sqrt(x(4AD³ + x (4A(D - x) - D )²)) + x (4A(D - x) - D ))/8Ax.
     */
    function getY(uint x) external view returns (uint) {
        uint _d = d; // Gas optimization
        uint _a4 = a << 2;
        uint _a8 = _a4 << 1;
        // 4A(D - x) - D
        int part1 = int(_a4) * (int(_d) - int(x)) - int(_d);
        // x * (4AD³ + x(part1²))
        uint part2 = x * (_a4 * _d * _d * _d + x * uint(part1 * part1));
        // (sqrt(part2) + x(part1)) / 8Ax)
        return SafeCast.toUint256(int(_sqrt(part2)) + int(x) * part1) / (_a8 * x) + 1; // +1 to offset rounding errors
    }

    /**
     * @dev price = (1/2) * ((D³ + 8ADx² - 8Ax³ - 2Dx²) / (4x * sqrt(x(4AD³ + x (4A(D - x) - D )²))))
     */
    function getPrice() external view returns (uint) {
        uint x = tokenBalance;
        uint _a8 = a << 3;
        uint _dCubed = d * d * d;

        // 4A(D - x) - D
        int p1 = int(a << 2) * (int(d) - int(x)) - int(d);
        // x * 4AD³ + x(p1²)
        uint p2 = x * ((a << 2) * _dCubed + x * uint(p1 * p1));
        // D³ + 8ADx² - 8Ax³ - 2Dx²
        int p3 = int(_dCubed) + int((a << 3) * d * x * x) - int(_a8 * x * x * x) - int((d << 1) * x * x);
        // 1/2 * p3 / (4x * sqrt(p2))
        return SafeCast.toUint256((PP >> 1) + ((PP * p3) / int((x << 2) * _sqrt(p2))));
    }

    function _updateD() internal {
        uint x = tokenBalance;
        uint y = vUsdBalance;
        // a = 8 * Axy(x+y)
        // b = 4 * xy(4A - 1) / 3
        // c = sqrt(a² + b³)
        // D = cbrt(a + c) + cbrt(a - c)
        uint xy = x * y;
        uint _a = a;
        // Axy(x+y)
        uint p1 = _a * xy * (x + y);
        // xy(4A - 1) / 3
        uint p2 = (xy * ((_a << 2) - 1)) / 3;
        // p1² + p2³
        uint p3 = _sqrt((p1 * p1) + (p2 * p2 * p2));
        unchecked {
            uint _d = _cbrt(p1 + p3);
            if (p3 > p1) {
                _d -= _cbrt(p3 - p1);
            } else {
                _d += _cbrt(p1 - p3);
            }
            d = (_d << 1);
        }
    }

    function _toSystemPrecision(uint amount) internal view returns (uint) {
        if (tokenAmountReduce > 0) {
            return amount / tokenAmountReduce;
        } else if (tokenAmountIncrease > 0) {
            return amount * tokenAmountIncrease;
        }
        return amount;
    }

    function _fromSystemPrecision(uint amount) internal view returns (uint) {
        if (tokenAmountReduce > 0) {
            return amount * tokenAmountReduce;
        } else if (tokenAmountIncrease > 0) {
            return amount / tokenAmountIncrease;
        }
        return amount;
    }

    function _sqrt(uint n) internal pure returns (uint) {
        unchecked {
            if (n > 0) {
                uint x = (n >> 1) + 1;
                uint y = (x + n / x) >> 1;
                while (x > y) {
                    x = y;
                    y = (x + n / x) >> 1;
                }
                return x;
            }
            return 0;
        }
    }

    function _cbrt(uint n) internal pure returns (uint) {
        unchecked {
            uint x = 0;
            for (uint y = 1 << 255; y > 0; y >>= 3) {
                x <<= 1;
                uint z = 3 * x * (x + 1) + 1;
                if (n / y >= z) {
                    n -= y * z;
                    x += 1;
                }
            }
            return x;
        }
    }

    fallback() external payable {
        revert("Unsupported");
    }

    receive() external payable {
        revert("Unsupported");
    }
}
