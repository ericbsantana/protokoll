// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/*
 * MonadVRFAdapter adversarial test suite
 * Created: 2026-05-09
 *
 * Purpose: one focused test per hostile-callback shape, with explicit
 * per-scenario assertions. The unit test file `MonadVRFAdapter.t.sol`
 * already covers most of these scenarios at the assertion level; this
 * file consolidates and extends them so a single test contract can be
 * cited from a future docs page on adapter robustness.
 *
 * Tests in this file (each guards against the listed bug class):
 *
 *   test_revertingConsumer_settlesAndPaysFulfiller
 *     Bug class: callback revert blocks fulfillment or strands escrow.
 *     Asserts RandomnessFulfilled emits with callbackOk=false, fulfilled
 *     flag is set, escrow is cleared, and the fulfiller is paid.
 *
 *   test_oogConsumer_settlesAndPaysFulfiller
 *     Bug class: callback gas exhaustion propagates into fulfill() and
 *     either reverts the round or skips the fulfiller payment.
 *     Asserts fulfill() succeeds, fulfilled flag is set, fulfiller is paid,
 *     and the outer call's gas use stays bounded.
 *
 *   test_reentrantConsumer_guardHoldsAndOuterSettles
 *     Bug class: a consumer re-enters fulfill() during its callback and
 *     either double-pays the fulfiller, double-fires the callback, or
 *     corrupts the (pending, fulfilled, escrow) state machine.
 *     Asserts the inner re-entered call reverts (AlreadyFulfilled fires),
 *     the outer fulfill settles cleanly, fulfilled flag is set exactly once,
 *     and the fulfiller is paid exactly once.
 *
 *   test_underpaymentRejectedBeforeStateChange
 *     Bug class: fee math accepts underpayment, or rejects it only after
 *     mutating pendingRequests/escrow, leaving the contract in a partially
 *     committed state.
 *     Asserts IncorrectFee fires with the exact (sent, expected) values,
 *     and that pendingRequests/fulfilled/escrow are all unchanged afterward.
 *
 * Scenarios already covered at the assertion level in MonadVRFAdapter.t.sol
 * and intentionally not duplicated here:
 *   - return-bomb callback        (MonadVRFAdapter.t.sol:test_returnBomb_doesNotInflateFulfillerGas)
 *   - reentrancy from fulfiller's receive() (MonadVRFAdapter.t.sol:test_reentrantFulfillFromFulfiller_reverts)
 *   - overpayment                 (MonadVRFAdapter.t.sol:test_overpayment_reverts)
 *   - duplicate request           (MonadVRFAdapter.t.sol:test_duplicateRequest_reverts)
 *   - replay fulfill              (MonadVRFAdapter.t.sol:test_replayFulfill_reverts)
 *
 * Setup: substitutes MockVerifier for the real verifier so that hostile
 * callback shapes can be exercised without generating valid VRF proofs.
 * This mirrors the A1 invariant suite pattern. Cryptographic correctness
 * is covered by MonadVRFAdapter.t.sol against the real verifier.
 */

import {Test} from "forge-std/Test.sol";
import {MonadVRFAdapter} from "../../src/contracts/MonadVRFAdapter.sol";
import {MockVerifier} from "./MockVerifier.sol";
import {MockGriefer, MockReverter, MockReentrant} from "./MockConsumer.sol";

contract MonadVRFAdapterAdversarial is Test {
    MockVerifier internal verifier;
    MonadVRFAdapter internal adapter;

    bytes32 constant PK0 = 0x000000000000000000000000000000000ce3b57b791798433fd323753489cac9;
    bytes32 constant PK1 = 0xbca43b98deaafaed91f4cb010730ae1e38b186ccd37a09b8aed62ce23b699c48;
    bytes32 constant PK2 = 0x00000000000000000000000000000000008c346228e4482ec20a2bf7d5a2fe74;
    bytes32 constant PK3 = 0xebf3c79b912d1b0ba977a873b66f7a9b8b42585a78c0c21d66da6a15767efdb1;

    bytes32 constant ROUND_ID = bytes32("round-1");
    uint256 constant FEE = 0.001 ether;

    // Proof bytes are irrelevant under MockVerifier (always returns true), but
    // the adapter still hashes gamma to derive beta. Use any non-empty payload.
    bytes constant DUMMY_GAMMA = hex"00";
    uint256 constant DUMMY_C = 0;
    uint256 constant DUMMY_S = 0;

    function setUp() public {
        verifier = new MockVerifier();
        adapter = new MonadVRFAdapter(address(verifier), PK0, PK1, PK2, PK3, FEE);
    }

    function _key(address consumer, bytes32 roundId) internal view returns (bytes32) {
        return adapter.requestKey(consumer, roundId);
    }

    function _expectedBeta(bytes memory gamma) internal pure returns (bytes32) {
        return sha256(abi.encodePacked(gamma));
    }

    // Property: a reverting callback does not block fulfillment. The round
    // settles, the event is emitted with callbackOk=false, and the fulfiller
    // is paid out of escrow.
    function test_revertingConsumer_settlesAndPaysFulfiller() public {
        MockReverter reverter = new MockReverter(address(adapter));
        vm.deal(address(reverter), 1 ether);
        reverter.requestRandomness{value: FEE}(ROUND_ID);

        bytes32 key = _key(address(reverter), ROUND_ID);
        assertEq(adapter.escrow(key), FEE, "escrow not held after request");

        address fulfiller = address(0xfeed);
        uint256 balBefore = fulfiller.balance;

        vm.expectEmit(true, true, false, true);
        emit MonadVRFAdapter.RandomnessFulfilled(address(reverter), ROUND_ID, _expectedBeta(DUMMY_GAMMA), false);

        vm.prank(fulfiller);
        adapter.fulfill(address(reverter), ROUND_ID, DUMMY_GAMMA, DUMMY_C, DUMMY_S);

        assertTrue(adapter.fulfilled(key), "round not marked fulfilled despite callback revert");
        assertFalse(adapter.pendingRequests(key), "pending flag still set after fulfill");
        assertEq(adapter.escrow(key), 0, "escrow not cleared");
        assertEq(fulfiller.balance - balBefore, FEE, "fulfiller not paid despite callback revert");
    }

    // Property: a callback that exhausts its gas budget cannot starve the
    // outer fulfill. The round settles, the fulfiller is paid, and total
    // gas use of fulfill stays bounded by the verifier+callback cap.
    function test_oogConsumer_settlesAndPaysFulfiller() public {
        MockGriefer griefer = new MockGriefer(address(adapter));
        vm.deal(address(griefer), 1 ether);
        griefer.requestRandomness{value: FEE}(ROUND_ID);

        bytes32 key = _key(address(griefer), ROUND_ID);

        address fulfiller = address(0xfeed);
        uint256 balBefore = fulfiller.balance;

        vm.expectEmit(true, true, false, true);
        emit MonadVRFAdapter.RandomnessFulfilled(address(griefer), ROUND_ID, _expectedBeta(DUMMY_GAMMA), false);

        uint256 gasBefore = gasleft();
        vm.prank(fulfiller);
        adapter.fulfill(address(griefer), ROUND_ID, DUMMY_GAMMA, DUMMY_C, DUMMY_S);
        uint256 gasUsed = gasBefore - gasleft();

        assertTrue(adapter.fulfilled(key), "round not marked fulfilled despite OOG callback");
        assertFalse(adapter.pendingRequests(key), "pending flag still set after fulfill");
        assertEq(adapter.escrow(key), 0, "escrow not cleared");
        assertEq(fulfiller.balance - balBefore, FEE, "fulfiller not paid despite OOG callback");
        // CALLBACK_GAS_LIMIT is 200_000; outer fulfill overhead (mock verifier,
        // hashing, storage) is small. Bound generously to avoid flake.
        assertLt(gasUsed, 500_000, "fulfill consumed too much gas under OOG callback");
    }

    // Property: a consumer that re-enters fulfill() during its callback hits
    // the AlreadyFulfilled guard (state was cleared CEI-style before the
    // callback fired). The outer fulfill still settles, the fulfiller is paid
    // exactly once, and the fulfilled flag is set exactly once.
    function test_reentrantConsumer_guardHoldsAndOuterSettles() public {
        MockReentrant reentrant = new MockReentrant(address(adapter));
        vm.deal(address(reentrant), 1 ether);
        reentrant.requestRandomness{value: FEE}(ROUND_ID);

        bytes32 key = _key(address(reentrant), ROUND_ID);

        address fulfiller = address(0xfeed);
        uint256 balBefore = fulfiller.balance;

        vm.prank(fulfiller);
        adapter.fulfill(address(reentrant), ROUND_ID, DUMMY_GAMMA, DUMMY_C, DUMMY_S);

        // The callback frame ran (the assembly call swallows reverts via ok=false).
        assertTrue(reentrant.reentryAttempted(), "callback never ran");
        // The re-entered fulfill must have reverted inside the callback.
        assertTrue(reentrant.lastReentryReverted(), "reentrant fulfill was not rejected");

        // Outer call settled cleanly.
        assertTrue(adapter.fulfilled(key), "round not fulfilled");
        assertFalse(adapter.pendingRequests(key), "pending flag still set");
        assertEq(adapter.escrow(key), 0, "escrow not cleared");
        assertEq(fulfiller.balance - balBefore, FEE, "fulfiller paid wrong amount");
        assertEq(address(adapter).balance, 0, "adapter retains stray balance after reentry attempt");
    }

    // Property: requestRandomness with msg.value != requestFee reverts with
    // IncorrectFee carrying the exact (sent, expected) values, and no state
    // is mutated. This is the "before any state change" guarantee: the typed
    // error fires on the first line of the function.
    function test_underpaymentRejectedBeforeStateChange() public {
        // Build a fresh consumer with no prior state.
        MockReverter consumer = new MockReverter(address(adapter));
        vm.deal(address(consumer), 1 ether);

        bytes32 key = _key(address(consumer), ROUND_ID);

        // Snapshot all state we expect to be unchanged.
        bool pendingBefore = adapter.pendingRequests(key);
        bool fulfilledBefore = adapter.fulfilled(key);
        uint256 escrowBefore = adapter.escrow(key);
        uint256 adapterBalBefore = address(adapter).balance;

        uint256 underpay = FEE - 1;
        vm.expectRevert(abi.encodeWithSelector(MonadVRFAdapter.IncorrectFee.selector, underpay, FEE));
        consumer.requestRandomness{value: underpay}(ROUND_ID);

        // No state change.
        assertEq(adapter.pendingRequests(key), pendingBefore, "pendingRequests changed on rejected underpayment");
        assertEq(adapter.fulfilled(key), fulfilledBefore, "fulfilled changed on rejected underpayment");
        assertEq(adapter.escrow(key), escrowBefore, "escrow changed on rejected underpayment");
        assertEq(address(adapter).balance, adapterBalBefore, "adapter balance changed on rejected underpayment");
    }
}
