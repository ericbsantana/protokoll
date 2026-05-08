// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRandomnessAdapter} from "./interfaces/IRandomnessAdapter.sol";
import {MonadVRFVerifier} from "./MonadVRFVerifier.sol";

// Request/fulfill adapter for the randnad VRF oracle.
//
// Flow:
//   1. Consumer calls requestRandomness(roundId)        - logged on-chain
//   2. Oracle detects the event, generates a proof off-chain
//   3. Oracle (or anyone) calls fulfill(roundId, gamma, c, s)
//   4. Verifier computes H = hash_to_curve(roundId) on-chain, checks proof
//   5. Adapter delivers beta = sha256(gamma) to consumer

contract MonadVRFAdapter {
    MonadVRFVerifier public immutable verifier;

    // EIP-2537 128-byte public key of the oracle. Set once at deploy.
    bytes public oraclePublicKey;

    mapping(bytes32 => address) public pendingRequests;
    mapping(bytes32 => bool) public fulfilled;

    event RandomnessRequested(bytes32 indexed roundId, address indexed requester);
    event RandomnessFulfilled(bytes32 indexed roundId, bytes32 beta);

    error AlreadyRequested(bytes32 roundId);
    error AlreadyFulfilled(bytes32 roundId);
    error NoPendingRequest(bytes32 roundId);
    error InvalidProof();

    constructor(address verifier_, bytes memory oraclePublicKey_) {
        verifier = MonadVRFVerifier(verifier_);
        oraclePublicKey = oraclePublicKey_;
    }

    /// @notice Request a verifiable random number for roundId.
    ///         The caller must implement IRandomnessAdapter to receive the result.
    function requestRandomness(bytes32 roundId) external {
        if (pendingRequests[roundId] != address(0)) revert AlreadyRequested(roundId);
        if (fulfilled[roundId]) revert AlreadyFulfilled(roundId);
        pendingRequests[roundId] = msg.sender;
        emit RandomnessRequested(roundId, msg.sender);
    }

    /// @notice Submit a VRF proof to fulfill a pending request.
    ///         Anyone can call this - the proof enforces correctness.
    ///         H = hash_to_curve(roundId) is computed on-chain by the verifier.
    /// @param roundId  Must match a pending request.
    /// @param gamma    gamma = k·H, EIP-2537 128-byte G1 point.
    /// @param c        Fiat-Shamir challenge.
    /// @param s        Proof response.
    function fulfill(bytes32 roundId, bytes calldata gamma, uint256 c, uint256 s) external {
        if (fulfilled[roundId]) revert AlreadyFulfilled(roundId);
        address requester = pendingRequests[roundId];
        if (requester == address(0)) revert NoPendingRequest(roundId);

        if (!verifier.verifyProof(oraclePublicKey, roundId, gamma, c, s)) revert InvalidProof();

        bytes32 beta = sha256(abi.encodePacked(gamma));

        fulfilled[roundId] = true;
        delete pendingRequests[roundId];

        emit RandomnessFulfilled(roundId, beta);

        try IRandomnessAdapter(requester).fulfillRandomness(roundId, beta) {} catch {}
    }
}
