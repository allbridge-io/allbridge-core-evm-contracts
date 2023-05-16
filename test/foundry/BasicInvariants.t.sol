// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.18;

import 'forge-std/console.sol';
import 'forge-std/StdInvariant.sol';

import 'forge-std/Test.sol';

import '../../contracts/test/TestBridgeForSwap.sol';

import './helpers/Token.sol';
import './handlers/PoolHandler.sol';

contract BasicInvariantTest is StdInvariant, Test {
    PoolHandler public poolHandler;

    Token public busd;
    Token public usdt;

    TestBridgeForSwap public bridge;

    address alice;
    address admin;

    function setUp() public {
        admin = makeAddr('Admin');
        alice = makeAddr('Alice');

        vm.startPrank(admin);
        busd = new Token(type(uint).max, 'BUSD', 'BUSD');
        usdt = new Token(type(uint).max, 'USDT', 'USDT');

        vm.label(address(busd), 'busd token');
        vm.label(address(usdt), 'usdt token');

        bridge = new TestBridgeForSwap();

        Pool poolBUSD = new Pool(
            address(bridge),
            20,
            busd,
            0,
            0,
            'BUSD',
            'BUSD'
        );
        Pool poolUSDT = new Pool(
            address(bridge),
            20,
            usdt,
            0,
            0,
            'BUSD',
            'BUSD'
        );

        vm.label(address(poolBUSD), 'busd pool');
        vm.label(address(poolUSDT), 'usdt pool');

        busd.approve(address(poolBUSD), type(uint).max);
        usdt.approve(address(poolUSDT), type(uint).max);

        busd.approve(address(bridge), type(uint).max);
        usdt.approve(address(bridge), type(uint).max);

        bridge.addPool(poolBUSD, addressToBytes32(address(busd)));
        bridge.addPool(poolUSDT, addressToBytes32(address(usdt)));

        busd.transfer(alice, type(uint).max / 1e10);
        usdt.transfer(alice, type(uint).max / 1e10);

        poolBUSD.deposit(100_000 ether);
        poolUSDT.deposit(100_000 ether);

        vm.stopPrank();

        vm.startPrank(alice);
        busd.approve(address(poolBUSD), type(uint).max);
        usdt.approve(address(poolUSDT), type(uint).max);

        busd.approve(address(bridge), type(uint).max);
        usdt.approve(address(bridge), type(uint).max);
        vm.stopPrank();

        poolHandler = new PoolHandler(
            alice,
            poolBUSD,
            poolUSDT,
            bridge,
            busd,
            usdt
        );

        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = PoolHandler.depositBUSD.selector;
        selectors[1] = PoolHandler.withdrawBUSD.selector;
        selectors[2] = PoolHandler.depositUSDT.selector;
        selectors[3] = PoolHandler.withdrawUSDT.selector;
        selectors[4] = PoolHandler.swapBUSD_USDT.selector;
        selectors[5] = PoolHandler.swapUSDT_BUSD.selector;

        targetSender(alice);

        targetSelector(
            FuzzSelector({addr: address(poolHandler), selectors: selectors})
        );
        targetContract(address(poolHandler));
    }

    function invariant_RealTokensShouldBeGreaterThanOrEqualToReserves() public {
        uint busdTokenBalance = busd.balanceOf(
            address(poolHandler.poolBUSD())
        );
        uint usdtTokenBalance = usdt.balanceOf(
            address(poolHandler.poolUSDT())
        );

        uint busdReserves = poolHandler.poolBUSD().reserves() * 10 ** (18 - poolHandler.SYSTEM_PRECISION());
        uint usdtReserves = poolHandler.poolUSDT().reserves() * 10 ** (18 - poolHandler.SYSTEM_PRECISION());

        assertLe(busdReserves, busdTokenBalance);
        assertLe(usdtReserves, usdtTokenBalance);
    }

    function invariant_TotalLpAmountAlwaysLessOrEqualD() public {
        uint busdTotalLpAmount = poolHandler.poolBUSD().totalSupply();
        uint busdD = poolHandler.poolBUSD().d();

        uint usdtTotalLpAmount = poolHandler.poolUSDT().totalSupply();
        uint usdtD = poolHandler.poolUSDT().d();

        uint maxDiff = 2;

        if (busdTotalLpAmount > busdD) {
            emit log_string('BUSD totalSupply > BUSD D');
            emit log_named_uint('BUSD totalSupply', busdTotalLpAmount);
            emit log_named_uint('BUSD D', busdD);

            assertLe(busdTotalLpAmount - busdD, maxDiff);
        } else {
            assertLe(busdTotalLpAmount, busdD);
        }

        if (usdtTotalLpAmount > usdtD) {
            emit log_string('USDT totalSupply > USDT D');
            emit log_named_uint('USDT totalSupply', usdtTotalLpAmount);
            emit log_named_uint('USDT D', usdtD);

            assertLe(usdtTotalLpAmount - usdtD, maxDiff);
        } else {
            assertLe(usdtTotalLpAmount, usdtD);
        }
    }

    function invariant_AliceDoesntMakeProfit() public {
        uint initUsdtAliceBalance = poolHandler.initUsdtAliceBalance();
        uint initBusdAliceBalance = poolHandler.initBusdAliceBalance();

        uint initSum = initUsdtAliceBalance + initBusdAliceBalance;

        uint usdtAliceBalance = usdt.balanceOf(alice);
        uint busdAliceBalance = busd.balanceOf(alice);

        uint sum = usdtAliceBalance + busdAliceBalance;

        assertLe(sum, initSum);
    }

    function addressToBytes32(
        address targetAddress
    ) public pure returns (bytes32) {
        return bytes32(uint(uint160(targetAddress)));
    }
}
