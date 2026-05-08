// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRandomnessAdapter} from "./interfaces/IRandomnessAdapter.sol";
import {MonadVRFVerifier} from "./MonadVRFVerifier.sol";

// Request/fulfill adapter for the randnad VRF oracle.
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

    // EIP-2537 128-byte public key of the oracle. Set once at deploy.
    bytes public oraclePublicKey;

    // Maximum gas forwarded to the consumer's fulfillRandomness callback.
    // A malicious or buggy consumer cannot consume more than this — fulfill()
    // remains cheap to call regardless of what the callback does. EIP-150
    // means the caller of fulfill() must supply at least
    // ~CALLBACK_GAS_LIMIT * 64/63 above the verifier overhead for the
    // callback to actually receive the full budget.
    uint256 public constant CALLBACK_GAS_LIMIT = 200_000;

    // Keyed on requestKey(consumer, roundId). True while a request is pending.
    mapping(bytes32 => bool) public pendingRequests;
    // Keyed on requestKey(consumer, roundId). True once fulfilled.
    mapping(bytes32 => bool) public fulfilled;

    event RandomnessRequested(bytes32 indexed roundId, address indexed requester);
    event RandomnessFulfilled(address indexed consumer, bytes32 indexed roundId, bytes32 beta, bool callbackOk);

    error AlreadyRequested(address consumer, bytes32 roundId);
    error AlreadyFulfilled(address consumer, bytes32 roundId);
    error NoPendingRequest(address consumer, bytes32 roundId);
    error InvalidProof();

    constructor(address verifier_, bytes memory oraclePublicKey_) {
        verifier = MonadVRFVerifier(verifier_);
        oraclePublicKey = oraclePublicKey_;
    }

    /// @notice Compute the storage key for a (consumer, roundId) pair.
    ///         Off-chain callers use this to look up pendingRequests/fulfilled
    ///         without recomputing the hash themselves.
    function requestKey(address consumer, bytes32 roundId) public pure returns (bytes32) {
        return keccak256(abi.encode(consumer, roundId));
    }

    /// @notice Request a verifiable random number for roundId.
    ///         The caller must implement IRandomnessAdapter to receive the result.
    function requestRandomness(bytes32 roundId) external {
        bytes32 key = requestKey(msg.sender, roundId);
        if (pendingRequests[key]) revert AlreadyRequested(msg.sender, roundId);
        if (fulfilled[key]) revert AlreadyFulfilled(msg.sender, roundId);
        pendingRequests[key] = true;
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

        if (!verifier.verifyProof(oraclePublicKey, roundId, gamma, c, s)) revert InvalidProof();

        bytes32 beta = sha256(abi.encodePacked(gamma));

        fulfilled[key] = true;
        delete pendingRequests[key];

        // Cap forwarded gas; ignore returndata to prevent return-bomb griefing.
        // Inline assembly explicitly passes (0, 0) for the output buffer so the
        // EVM never copies returndata into memory regardless of size.
        bytes memory payload = abi.encodeCall(IRandomnessAdapter.fulfillRandomness, (roundId, beta));
        bool ok;
        assembly {
            ok := call(
                CALLBACK_GAS_LIMIT,
                consumer,
                0,
                add(payload, 0x20),
                mload(payload),
                0,
                0
            )
        }

        emit RandomnessFulfilled(consumer, roundId, beta, ok);
    }
}
