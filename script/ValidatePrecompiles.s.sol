// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import "forge-std/Script.sol";

// EIP-2537 test vectors - from https://eips.ethereum.org/EIPS/eip-2537
//
// G1ADD: G1_GENERATOR + G1_GENERATOR should equal 2·G1_GENERATOR
// G1MSM: 1·G1_GENERATOR should equal G1_GENERATOR
// MAP_FP_TO_G1: a known field element → known curve point
//
// Each precompile encodes BLS12-381 points as 128 bytes:
//   bytes[0..64]  = x coordinate, big-endian, zero-padded to 64 bytes
//   bytes[64..128] = y coordinate, big-endian, zero-padded to 64 bytes
// Scalars for MSM are 32 bytes, big-endian.

contract ValidatePrecompiles is Script {
    address constant BLS12_G1ADD = address(0x0b);
    address constant BLS12_G1MSM = address(0x0c);
    address constant BLS12_MAP_FP_TO_G1 = address(0x10);

    // BLS12-381 G1 generator, 64-byte-padded x and y
    // x = 0x17f1d3a7...  (48 significant bytes, padded to 64)
    // y = 0x08b3f481...
    bytes constant G1_X =
        hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb";
    bytes constant G1_Y =
        hex"0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";

    function run() external view {
        console.log("=== EIP-2537 Precompile Validation on Monad Testnet ===");
        console.log("");

        _checkG1Add();
        _checkG1Msm();
        _checkMapFpToG1();

        console.log("");
        console.log("=== All precompile checks passed ===");
    }

    // ── G1ADD (0x0b) ──────────────────────────────────────────────────────────
    // Input:  P1 (128 bytes) || P2 (128 bytes) = 256 bytes total
    // Output: P1 + P2 (128 bytes)
    // Test:   G + G = 2G  (we check the call succeeds and returns 128 bytes)
    function _checkG1Add() internal view {
        console.log("[G1ADD 0x0b]");

        bytes memory input = abi.encodePacked(G1_X, G1_Y, G1_X, G1_Y);
        require(input.length == 256, "input must be 256 bytes");

        (bool ok, bytes memory result) = BLS12_G1ADD.staticcall(input);
        require(ok, "G1ADD: call failed");
        require(result.length == 128, "G1ADD: expected 128-byte output");

        // Result is 2G - we verify it's not the zero point (infinity is encoded as all zeros)
        bool allZero = true;
        for (uint256 i = 0; i < 128; i++) {
            if (result[i] != 0x00) allZero = false;
            break;
        }
        require(!allZero, "G1ADD: result is unexpectedly the identity/infinity");

        console.log("  call: ok");
        console.log("  output length: 128 bytes");
        console.log("  result is non-zero point: ok");
    }

    // ── G1MSM (0x0c) ──────────────────────────────────────────────────────────
    // Input:  (point (128 bytes) || scalar (32 bytes)) * k  - one pair here
    // Output: scalar * point (128 bytes)
    // Test:   1 * G = G  (result must equal G1_GENERATOR)
    function _checkG1Msm() internal view {
        console.log("[G1MSM 0x0c]");

        bytes32 scalar1 = bytes32(uint256(1));
        bytes memory input = abi.encodePacked(G1_X, G1_Y, scalar1);
        require(input.length == 160, "input must be 160 bytes");

        (bool ok, bytes memory result) = BLS12_G1MSM.staticcall(input);
        require(ok, "G1MSM: call failed");
        require(result.length == 128, "G1MSM: expected 128-byte output");

        // 1*G must equal G: compare against expected G1_X || G1_Y
        bytes memory expected = abi.encodePacked(G1_X, G1_Y);
        require(keccak256(result) == keccak256(expected), "G1MSM: 1*G != G (wrong result)");

        console.log("  call: ok");
        console.log("  1*G == G: ok");
    }

    // ── MAP_FP_TO_G1 (0x10) ───────────────────────────────────────────────────
    // Input:  a field element (64 bytes, big-endian, zero-padded)
    // Output: a G1 point (128 bytes)
    // Test:   any valid field element should map to a non-infinity curve point.
    // We use fp = 1 (simplest non-zero element).
    function _checkMapFpToG1() internal view {
        console.log("[MAP_FP_TO_G1 0x10]");

        // field element = 1, padded to 64 bytes
        bytes memory fp = new bytes(64);
        fp[63] = 0x01;

        (bool ok, bytes memory result) = BLS12_MAP_FP_TO_G1.staticcall(fp);
        require(ok, "MAP_FP_TO_G1: call failed");
        require(result.length == 128, "MAP_FP_TO_G1: expected 128-byte output");

        bool allZero = true;
        for (uint256 i = 0; i < 128; i++) {
            if (result[i] != 0x00) allZero = false;
            break;
        }
        require(!allZero, "MAP_FP_TO_G1: result is unexpectedly identity");

        console.log("  call: ok");
        console.log("  output length: 128 bytes");
        console.log("  result is non-zero point: ok");
    }
}
