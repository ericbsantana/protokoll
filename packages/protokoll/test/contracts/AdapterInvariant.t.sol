// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MonadVRFAdapter} from "../../src/contracts/MonadVRFAdapter.sol";
import {MockVerifier} from "./MockVerifier.sol";
import {AdapterHandler} from "./handlers/AdapterHandler.sol";

// Foundry invariant suite for MonadVRFAdapter. Each `invariant_*` is a
// property that must hold across all randomized call sequences the fuzzer
// drives through `AdapterHandler`. See AdapterHandler.sol for the action
// surface and ghost variables.
contract AdapterInvariantTest is Test {
    MockVerifier internal mockVerifier;
    MonadVRFAdapter internal adapter;
    AdapterHandler internal handler;

    // Same EIP-2537 oracle key used by the unit tests; required to pass the
    // adapter's constructor G1MSM smoke check.
    bytes32 constant PK0 = 0x000000000000000000000000000000000ce3b57b791798433fd323753489cac9;
    bytes32 constant PK1 = 0xbca43b98deaafaed91f4cb010730ae1e38b186ccd37a09b8aed62ce23b699c48;
    bytes32 constant PK2 = 0x00000000000000000000000000000000008c346228e4482ec20a2bf7d5a2fe74;
    bytes32 constant PK3 = 0xebf3c79b912d1b0ba977a873b66f7a9b8b42585a78c0c21d66da6a15767efdb1;

    uint256 constant FEE = 0.001 ether;

    function setUp() public {
        mockVerifier = new MockVerifier();
        adapter = new MonadVRFAdapter(address(mockVerifier), PK0, PK1, PK2, PK3, FEE);
        handler = new AdapterHandler(adapter, mockVerifier);
        // Confine the fuzzer to handler entry points; otherwise it'd also
        // call this test contract's externals, which is meaningless.
        targetContract(address(handler));
    }

    // T1: a (consumer, roundId) pair is fulfilled at most once.
    // Important: bypass means duplicate payouts (lottery double-redeem,
    // game double-reveal).
    function invariant_neverDoubleFulfilled() public view {
        uint256 n = handler.touchedKeysLength();
        for (uint256 i = 0; i < n; i++) {
            bytes32 key = handler.touchedKeys(i);
            assertLe(handler.fulfillCount(key), 1, "double fulfill detected");
        }
    }

    // T2: actual escrow held by the adapter equals what the handler expected
    // based on (successful requests - successful fulfills) * FEE.
    // Important: drift means stuck funds or duplicated payouts.
    function invariant_totalEscrowMatchesGhost() public view {
        uint256 n = handler.touchedKeysLength();
        uint256 total;
        for (uint256 i = 0; i < n; i++) {
            total += adapter.escrow(handler.touchedKeys(i));
        }
        assertEq(total, handler.ghostExpectedEscrow(), "escrow accounting drift");
    }

    // T3: a key is never both pending and fulfilled at the same time.
    // Important: contradictory state lets observers act on stale data.
    function invariant_pendingXorFulfilled() public view {
        uint256 n = handler.touchedKeysLength();
        for (uint256 i = 0; i < n; i++) {
            bytes32 key = handler.touchedKeys(i);
            assertFalse(adapter.pendingRequests(key) && adapter.fulfilled(key), "pending and fulfilled both true");
        }
    }

    // T4: adapter's actual ETH balance equals sum(escrow[key]) across touched keys.
    // Important: bridges adapter's internal accounting to EVM ground truth;
    // catches accidental burns and unauthorized transfers.
    // Equality (vs `>=`) holds because no contract in this harness self-destructs
    // value into the adapter; selfdestruct injection is out of scope for A1.
    function invariant_balanceCoversEscrow() public view {
        uint256 n = handler.touchedKeysLength();
        uint256 totalEscrow;
        for (uint256 i = 0; i < n; i++) {
            totalEscrow += adapter.escrow(handler.touchedKeys(i));
        }
        assertEq(address(adapter).balance, totalEscrow, "adapter balance does not match escrow sum");
    }

    // T5: total ETH paid back to the fulfiller equals FEE * successful fulfills.
    // Important: catches over/underpayment and payments routed to the wrong recipient.
    function invariant_paidOutMatchesFulfilledFees() public view {
        uint256 expected = handler.successfulFulfillCount() * FEE;
        assertEq(handler.ghostTotalPaidOut(), expected, "fulfiller payment drift");
    }

    // Smoke test, not an invariant: proves the harness can actually drive a
    // successful fulfill. If this fails, every invariant above is vacuous.
    // Cannot be an `invariant_*` because invariants are checked at the initial
    // state too, where this would necessarily be false.
    function test_harnessReachesFulfill() public {
        handler.request(0, 0);
        handler.fulfill(0, 0);
        assertGt(handler.successfulFulfillCount(), 0, "harness never reached a successful fulfill");
    }
}
