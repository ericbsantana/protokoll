// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IRandomnessAdapter} from "./interfaces/IRandomnessAdapter.sol";
import {MonadVRFVerifier} from "./MonadVRFVerifier.sol";

// Request/fulfill adapter for the protokoll VRF oracle.
//
// Flow:
//   1. Consumer calls requestRandomness(roundId)            - logged on-chain
//   2. Oracle detects the event, generates a proof off-chain
//   3. Oracle (or anyone) calls fulfill(consumer, roundId, gamma, c, s)
//   4. Verifier computes H = hash_to_curve(roundId) on-chain, checks proof
//   5. Adapter delivers beta = sha256(gamma) to consumer
//
// Request keys are namespaced by (consumer, roundId), so two consumers
// can independently request the same roundId, and no third party can
// "squat" a roundId to redirect the callback away from the legitimate
// consumer. The proof itself depends only on roundId (H = hash_to_curve(roundId)),
// so the same proof fulfills any consumer that requested that roundId.

contract MonadVRFAdapter {
    MonadVRFVerifier public immutable verifier;

    // EIP-2537 128-byte public key of the oracle, stored as four bytes32
    // immutables. Storing as immutable (instead of a storage `bytes`) means
    // the value is fixed at construction and cannot be repurposed by a future
    // maintainer adding a setter. Reconstruct via oraclePublicKey().
    bytes32 private immutable pk0;
    bytes32 private immutable pk1;
    bytes32 private immutable pk2;
    bytes32 private immutable pk3;

    // BLS12_G1MSM precompile (EIP-2537 §0x0c). Subgroup-checks its inputs;
    // we use it at construction to validate the public key is a real G1 point
    // in the prime-order subgroup, not just well-formed bytes.
    address private constant G1MSM = address(0x0c);

    // Flat fee charged per request, paid in MON. Fully forwarded to whoever
    // submits the matching fulfill(). Set at construction; immutable.
    // A zero fee means the service is free (suitable for testing or subsidised
    // deployments) - no value is transferred and no escrow is touched.
    uint256 public immutable requestFee;

    // Maximum gas forwarded to the consumer's fulfillRandomness callback.
    // A malicious or buggy consumer cannot consume more than this - fulfill()
    // remains cheap to call regardless of what the callback does. EIP-150
    // means the caller of fulfill() must supply at least
    // ~CALLBACK_GAS_LIMIT * 64/63 above the verifier overhead for the
    // callback to actually receive the full budget.
    uint256 public constant CALLBACK_GAS_LIMIT = 200_000;

    // Keyed on requestKey(consumer, roundId). True while a request is pending.
    mapping(bytes32 => bool) public pendingRequests;
    // Keyed on requestKey(consumer, roundId). True once fulfilled.
    mapping(bytes32 => bool) public fulfilled;
    // Per-request fee escrow, keyed on requestKey(consumer, roundId). Cleared
    // on fulfill before the value is transferred to the fulfiller (CEI).
    mapping(bytes32 => uint256) public escrow;

    event RandomnessRequested(bytes32 indexed roundId, address indexed requester);
    event RandomnessFulfilled(address indexed consumer, bytes32 indexed roundId, bytes32 beta, bool callbackOk);

    error AlreadyRequested(address consumer, bytes32 roundId);
    error AlreadyFulfilled(address consumer, bytes32 roundId);
    error NoPendingRequest(address consumer, bytes32 roundId);
    error InvalidProof();
    error IncorrectFee(uint256 sent, uint256 expected);
    error FeeTransferFailed();
    error InvalidPublicKey();

    constructor(address verifier_, bytes32 pk0_, bytes32 pk1_, bytes32 pk2_, bytes32 pk3_, uint256 requestFee_) {
        verifier = MonadVRFVerifier(verifier_);
        pk0 = pk0_;
        pk1 = pk1_;
        pk2 = pk2_;
        pk3 = pk3_;
        requestFee = requestFee_;

        // Reject the identity (all-zero coordinates) - not a useful signing key.
        if (pk0_ == bytes32(0) && pk1_ == bytes32(0) && pk2_ == bytes32(0) && pk3_ == bytes32(0)) {
            revert InvalidPublicKey();
        }

        // Smoke-call G1MSM with scalar 1 to force EIP-2537 subgroup-membership
        // and on-curve checks at deploy time. Per EIP-2537 the precompile MUST
        // return an error on any input that fails the subgroup check, which we
        // surface here as InvalidPublicKey.
        (bool ok, bytes memory out) = G1MSM.staticcall(abi.encodePacked(pk0_, pk1_, pk2_, pk3_, bytes32(uint256(1))));
        if (!ok || out.length != 128) revert InvalidPublicKey();
    }

    /// @notice Reconstruct the EIP-2537 128-byte oracle public key from the
    ///         four immutable chunks. Cheap (no SLOADs).
    function oraclePublicKey() public view returns (bytes memory) {
        return abi.encodePacked(pk0, pk1, pk2, pk3);
    }

    /// @notice Compute the storage key for a (consumer, roundId) pair.
    ///         Off-chain callers use this to look up pendingRequests/fulfilled
    ///         without recomputing the hash themselves.
    function requestKey(address consumer, bytes32 roundId) public pure returns (bytes32) {
        return keccak256(abi.encode(consumer, roundId));
    }

    /// @notice Request a verifiable random number for roundId.
    ///         The caller must implement IRandomnessAdapter to receive the result.
    ///         msg.value MUST exactly equal requestFee (over- or under-payment reverts;
    ///         this avoids dust accumulation and refund logic).
    function requestRandomness(bytes32 roundId) external payable {
        if (msg.value != requestFee) revert IncorrectFee(msg.value, requestFee);
        bytes32 key = requestKey(msg.sender, roundId);
        if (pendingRequests[key]) revert AlreadyRequested(msg.sender, roundId);
        if (fulfilled[key]) revert AlreadyFulfilled(msg.sender, roundId);
        pendingRequests[key] = true;
        if (msg.value > 0) escrow[key] = msg.value;
        emit RandomnessRequested(roundId, msg.sender);
    }

    /// @notice Submit a VRF proof to fulfill a pending request.
    ///         Anyone can call this - the proof enforces correctness.
    ///         H = hash_to_curve(roundId) is computed on-chain by the verifier.
    /// @param consumer The address that requested randomness; receives the callback.
    /// @param roundId  Must match a pending request from `consumer`.
    /// @param gamma    gamma = k·H, EIP-2537 128-byte G1 point.
    /// @param c        Fiat-Shamir challenge.
    /// @param s        Proof response.
    function fulfill(address consumer, bytes32 roundId, bytes calldata gamma, uint256 c, uint256 s) external {
        bytes32 key = requestKey(consumer, roundId);
        if (fulfilled[key]) revert AlreadyFulfilled(consumer, roundId);
        if (!pendingRequests[key]) revert NoPendingRequest(consumer, roundId);

        if (!verifier.verifyProof(oraclePublicKey(), roundId, gamma, c, s)) revert InvalidProof();

        bytes32 beta = sha256(abi.encodePacked(gamma));

        // CEI: clear all state related to this request before any external call.
        fulfilled[key] = true;
        delete pendingRequests[key];
        uint256 fee = escrow[key];
        if (fee > 0) delete escrow[key];

        // Cap forwarded gas; ignore returndata to prevent return-bomb griefing.
        // Inline assembly explicitly passes (0, 0) for the output buffer so the
        // EVM never copies returndata into memory regardless of size.
        bytes memory payload = abi.encodeCall(IRandomnessAdapter.fulfillRandomness, (roundId, beta));
        bool ok;
        assembly {
            ok := call(CALLBACK_GAS_LIMIT, consumer, 0, add(payload, 0x20), mload(payload), 0, 0)
        }

        emit RandomnessFulfilled(consumer, roundId, beta, ok);

        // Pay the fulfiller. State is already cleared, so a reentrant fulfill()
        // for the same (consumer, roundId) reverts on the AlreadyFulfilled check.
        // If the fulfiller cannot receive MON (no payable fallback), the entire
        // tx reverts and the round stays pending for another fulfiller to take.
        if (fee > 0) {
            (bool sent,) = msg.sender.call{value: fee}("");
            if (!sent) revert FeeTransferFailed();
        }
    }
}
