// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import 'forge-std/Base.sol';
import 'forge-std/console.sol';
import 'forge-std/StdUtils.sol';
import 'forge-std/StdCheats.sol';
import 'forge-std/StdAssertions.sol';

import '../../../contracts/Pool.sol';
import '../../../contracts/test/TestBridgeForSwap.sol';

import '../helpers/Token.sol';

contract PoolHandler is CommonBase, StdCheats, StdUtils, StdAssertions {
    Pool public poolBUSD;
    Pool public poolUSDT;

    Token public busd;
    Token public usdt;

    uint public initUsdtAliceBalance;
    uint public initBusdAliceBalance;

    TestBridgeForSwap public bridge;

    uint public constant SYSTEM_PRECISION = 3;

    // $1
    uint public minDeposit = 1 * 1e18;
    // $50M
    uint public maxDeposit = 50e6 * 1e18;

    // $10
    uint public minWithdraw = 10 * 1e3;
    uint public maxWithdraw;

    // $5
    uint private constant MIN_SWAP = 5 * 1e18;

    address public alice;

    mapping(bytes32 => uint) public calls;

    modifier countCall(bytes32 key) {
        calls[key]++;
        _;
    }

    modifier useAlice() {
        vm.startPrank(alice);
        _;
        vm.stopPrank();
    }

    constructor(
        address _alice,
        Pool _poolBUSD,
        Pool _poolUSDT,
        TestBridgeForSwap _bridge,
        Token _busd,
        Token _usdt
    ) {
        alice = _alice;
        bridge = _bridge;
        poolBUSD = _poolBUSD;
        poolUSDT = _poolUSDT;
        usdt = _usdt;
        busd = _busd;

        initUsdtAliceBalance = _usdt.balanceOf(_alice);
        initBusdAliceBalance = _busd.balanceOf(_alice);
    }

    function depositBUSD(
        uint amount
    ) public useAlice countCall('depositBUSD') {
        amount = bound(amount, minDeposit, maxDeposit);

        poolBUSD.deposit(amount);
        logPoolInfo('BUSD', poolBUSD);
        logPoolInfo('USDT', poolUSDT);
    }

    function withdrawBUSD(
        uint amountLp
    ) public useAlice countCall('withdrawBUSD') {
        uint lpAmount = Math.min(poolBUSD.balanceOf(alice), poolBUSD.reserves());

        if (lpAmount < minWithdraw) {
            emit log_string('BUSD: lpAmount < 1e3');
            return;
        }

        amountLp = getWithdrawAmount(amountLp, lpAmount);
        poolBUSD.withdraw(amountLp);

        logPoolInfo('BUSD', poolBUSD);
        logPoolInfo('USDT', poolUSDT);
    }

    function depositUSDT(
        uint amount
    ) public useAlice countCall('depositUSDT') {
        amount = bound(amount, minDeposit, maxDeposit);

        poolUSDT.deposit(amount);

        logPoolInfo('BUSD', poolBUSD);
        logPoolInfo('USDT', poolUSDT);
    }

    function withdrawUSDT(
        uint amountLp
    ) public useAlice countCall('withdrawUSDT') {
        uint lpAmount = Math.min(poolUSDT.balanceOf(alice), poolUSDT.reserves());

        if (lpAmount < minWithdraw) {
            emit log_string('USDT: lpAmount < 1e3');
            return;
        }

        amountLp = getWithdrawAmount(amountLp, lpAmount);
        poolUSDT.withdraw(amountLp);

        logPoolInfo('BUSD', poolBUSD);
        logPoolInfo('USDT', poolUSDT);
    }

    function swapBUSD_USDT(
        uint amount
    ) public useAlice countCall('swapBUSD_USDT') {
        amount = getSwapAmount(amount, poolUSDT);
        if (amount == 0) {
            emit log_string('Nothing to swap');
            return;
        }

        bridge.swap(
            amount,
            addressToBytes32(address(busd)),
            addressToBytes32(address(usdt)),
            alice,
            0
        );

        logPoolInfo('BUSD', poolBUSD);
        logPoolInfo('USDT', poolUSDT);
    }

    function swapUSDT_BUSD(
        uint amount
    ) public useAlice countCall('swapUSDT_BUSD') {
        amount = getSwapAmount(amount, poolBUSD);
        if (amount == 0) {
            emit log_string('Nothing to swap');
            return;
        }

        bridge.swap(
            amount,
            addressToBytes32(address(usdt)),
            addressToBytes32(address(busd)),
            alice,
            0
        );

        logPoolInfo('BUSD', poolBUSD);
        logPoolInfo('USDT', poolUSDT);
    }

    function getSwapAmount(
        uint amount,
        Pool pool
    ) public view returns (uint) {
        uint up = pool.reserves() * 10 ** (18 - SYSTEM_PRECISION);

        if (up < MIN_SWAP) return 0;
        return bound(amount, MIN_SWAP, up);
    }

    function getWithdrawAmount(
        uint amountLp,
        uint lpAmount
    ) public view returns (uint) {
        uint up = maxWithdraw == 0 ? lpAmount : maxWithdraw;

        return bound(amountLp, minWithdraw, up);
    }

    function setMinDeposit(uint value) public {
        minDeposit = value;
    }

    function setMaxDeposit(uint value) public {
        maxDeposit = value;
    }

    function setMinWithdraw(uint value) public {
        minWithdraw = value;
    }

    function setMaxWithdraw(uint value) public {
        maxWithdraw = value;
    }

    function logPoolInfo(string memory token, Pool pool) public {
        emit log_named_string("token", token);
        uint256 totalLpAmount = pool.totalSupply();
        emit log_named_uint("totalLpAmount", totalLpAmount);
        uint256 d = pool.d();
        emit log_named_uint("d", d);
        uint256 tokenBalance = pool.tokenBalance();
        emit log_named_uint("tokenBalance", tokenBalance);
        uint256 vUsdBalance = pool.vUsdBalance();
        emit log_named_uint("vUsdBalance", vUsdBalance);
        uint256 reserves = pool.reserves();
        emit log_named_uint("reserves", reserves);
    }

    function addressToBytes32(
        address targetAddress
    ) public pure returns (bytes32) {
        return bytes32(uint(uint160(targetAddress)));
    }
}
