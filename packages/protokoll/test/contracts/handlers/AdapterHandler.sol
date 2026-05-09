// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {MonadVRFAdapter} from "../../../src/contracts/MonadVRFAdapter.sol";
import {MockVerifier} from "../MockVerifier.sol";
import {MockConsumer, MockGriefer, MockReverter, MockReturnBomb} from "../MockConsumer.sol";

// Action surface for AdapterInvariant.t.sol. The fuzzer calls only these
// external functions; try/catch swallows expected reverts so they don't
// fail the run. Bounded space (8 actors × 32 roundIds) ensures collisions.
contract AdapterHandler is Test {
    MonadVRFAdapter public immutable adapter;
    MockVerifier public immutable mockVerifier;

    uint256 public constant ROUND_SPACE = 32;
    uint256 public constant FEE = 0.001 ether;

    // Any 128-byte gamma works; MockVerifier ignores it.
    bytes public constant GAMMA = hex"00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000";

    address[] public actors;

    // Ghost state, compared against actual adapter state by the invariants:
    mapping(bytes32 => uint256) public fulfillCount;       // T1: per-key successful fulfills
    bytes32[] public touchedKeys;                           // enumeration helper
    mapping(bytes32 => bool) private _keyTouched;
    uint256 public successfulFulfillCount;                  // smoke counter
    uint256 public ghostExpectedEscrow;                     // T2: expected sum of adapter.escrow
    uint256 public ghostTotalPaidOut;                       // T5: ETH actually received as fulfiller

    constructor(MonadVRFAdapter adapter_, MockVerifier mockVerifier_) {
        adapter = adapter_;
        mockVerifier = mockVerifier_;

        // 5 well-behaved consumers + 3 hostile ones (callback OOG, revert,
        // return-bomb) so every invariant is checked against adversarial
        // callback shapes, not just the happy path.
        for (uint256 i = 0; i < 5; i++) {
            actors.push(address(new MockConsumer(address(adapter))));
        }
        actors.push(address(new MockGriefer(address(adapter))));
        actors.push(address(new MockReverter(address(adapter))));
        actors.push(address(new MockReturnBomb(address(adapter))));

        // Handler pays FEE on every request and gets it back on fulfill.
        // Overfund to absorb any in-transit value.
        vm.deal(address(this), 1_000_000 ether);
    }

    // Receive the request fee when this contract acts as fulfiller.
    receive() external payable {}

    function _pickActor(uint256 seed) internal view returns (address) {
        return actors[seed % actors.length];
    }

    function _roundId(uint256 seed) internal pure returns (bytes32) {
        return bytes32(seed % ROUND_SPACE);
    }

    function _trackKey(bytes32 key) internal {
        if (!_keyTouched[key]) {
            _keyTouched[key] = true;
            touchedKeys.push(key);
        }
    }

    // Place an order. Reverts (already-requested, etc.) are expected and swallowed.
    function request(uint256 actorSeed, uint256 roundSeed) external {
        address actor = _pickActor(actorSeed);
        bytes32 roundId = _roundId(roundSeed);
        bytes32 key = adapter.requestKey(actor, roundId);
        _trackKey(key);
        try MockConsumer(payable(actor)).requestRandomness{value: FEE}(roundId) {
            ghostExpectedEscrow += FEE;
        } catch {}
    }

    // Try to deliver. MockVerifier accepts, so this lands when the order is
    // pending. Otherwise the adapter reverts and try/catch swallows it.
    function fulfill(uint256 actorSeed, uint256 roundSeed) external {
        address consumer = _pickActor(actorSeed);
        bytes32 roundId = _roundId(roundSeed);
        bytes32 key = adapter.requestKey(consumer, roundId);
        _trackKey(key);

        // Balance diff measures actual ETH the adapter paid us as fulfiller.
        uint256 balBefore = address(this).balance;
        try adapter.fulfill(consumer, roundId, GAMMA, 0, 0) {
            fulfillCount[key] += 1;
            successfulFulfillCount += 1;
            ghostExpectedEscrow -= FEE;
            ghostTotalPaidOut += address(this).balance - balBefore;
        } catch {}
    }

    function touchedKeysLength() external view returns (uint256) {
        return touchedKeys.length;
    }

    function actorsLength() external view returns (uint256) {
        return actors.length;
    }
}
