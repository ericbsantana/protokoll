// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Minimal consumer interface - any contract that needs verifiable randomness implements this.
interface IRandomnessAdapter {
    /// @notice Called by the oracle once the VRF proof is verified on-chain.
    /// @param roundId   The round identifier the proof was generated for.
    /// @param beta      The 32-byte VRF output (the random value).
    function fulfillRandomness(bytes32 roundId, bytes32 beta) external;
}
