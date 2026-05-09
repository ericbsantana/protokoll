// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

// Substitute for MonadVRFVerifier used by the invariant fuzzer. Real verifier
// rejects ~all random inputs, so invariants would be vacuous; this lets the
// fuzzer reach adapter state. Crypto correctness is covered by unit tests.
contract MockVerifier {
    bool public accept = true;

    function setAccept(bool v) external {
        accept = v;
    }

    function verifyProof(bytes calldata, bytes32, bytes calldata, uint256, uint256)
        external
        view
        returns (bool)
    {
        return accept;
    }
}
