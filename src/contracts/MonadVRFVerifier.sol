// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// DLEQ verifier - H is computed on-chain from roundId via RFC 9380 hash-to-curve.
// No trust assumption on the oracle for the H value.
//
// Hash-to-curve pipeline (RFC 9380):
//   1. expand_message_xmd(roundId, DST, 128)  → 128 uniform bytes  (5× SHA-256)
//   2. reduce each 64-byte chunk mod p          → 2 field elements   (modexp 0x05)
//   3. MAP_FP_TO_G1 on each field element       → 2 G1 points        (precompile 0x10)
//   4. G1ADD the two points                     → H                  (precompile 0x0b)
//
// Precompiles used:
//   0x05  MODEXP        - big-int mod reduction (standard EVM)
//   0x0b  BLS12_G1ADD   - point addition
//   0x0c  BLS12_G1MSM   - multi-scalar multiplication
//   0x10  BLS12_MAP_FP_TO_G1 - SWU map + cofactor clearing

contract MonadVRFVerifier {
    address constant MODEXP = address(0x05);
    address constant G1ADD = address(0x0b);
    address constant G1MSM = address(0x0c);
    address constant MAP_FP_TO_G1 = address(0x10);

    uint256 constant CURVE_ORDER = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001;

    // G1 generator - EIP-2537 128-byte format: [16 zero][48-byte x][16 zero][48-byte y]
    bytes constant G = hex"0000000000000000000000000000000017f1d3a73197d7942695638c4fa9ac0fc3688c4f9774b905a14e3a3f171bac586c55e83ff97a1aeffb3af00adb22c6bb"
        hex"0000000000000000000000000000000008b3f481e3aaa0f1a09e30ed741d8ae4fcf5e095d5d00af600db18cb2c04b3edd03cc744a2888ae40caa232946c5e7e1";

    // BLS12-381 field prime p (48 bytes, 381 bits)
    bytes constant FP_MODULUS =
        hex"1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab";

    // Domain separation tag - MUST match oracle/proof.ts DST constant
    bytes constant DST = "randnad-v1";

    /// @notice Verify a DLEQ proof. H = hash_to_curve(roundId) is computed here.
    /// @param publicKey  Y = k·G, EIP-2537 128-byte G1 point
    /// @param roundId    Round identifier - used to derive H on-chain
    /// @param gamma      γ = k·H, EIP-2537 128-byte G1 point
    /// @param c          Fiat-Shamir challenge
    /// @param s          Proof response
    function verifyProof(bytes calldata publicKey, bytes32 roundId, bytes calldata gamma, uint256 c, uint256 s)
        external
        view
        returns (bool)
    {
        if (publicKey.length != 128 || gamma.length != 128) return false;

        bytes memory h = _hashToCurve(abi.encodePacked(roundId));

        // U' = s·G + c·Y
        (bool ok1, bytes memory uPrime) = G1MSM.staticcall(abi.encodePacked(G, bytes32(s), publicKey, bytes32(c)));
        if (!ok1 || uPrime.length != 128) return false;

        // V' = s·H + c·γ
        (bool ok2, bytes memory vPrime) = G1MSM.staticcall(abi.encodePacked(h, bytes32(s), gamma, bytes32(c)));
        if (!ok2 || vPrime.length != 128) return false;

        // c' = sha256(G || Y || H || γ || U' || V') mod n
        uint256 cPrime = uint256(sha256(abi.encodePacked(G, publicKey, h, gamma, uPrime, vPrime))) % CURVE_ORDER;

        return cPrime == c;
    }

    // ── RFC 9380 hash-to-curve ────────────────────────────────────────────────

    function _hashToCurve(bytes memory msg) internal view returns (bytes memory) {
        bytes memory uniform = _expandMessageXmd(msg); // 128 bytes

        // Extract four 32-byte words: uniform = u0hi||u0lo||u1hi||u1lo
        bytes32 u0hi;
        bytes32 u0lo;
        bytes32 u1hi;
        bytes32 u1lo;
        assembly {
            u0hi := mload(add(uniform, 32))
            u0lo := mload(add(uniform, 64))
            u1hi := mload(add(uniform, 96))
            u1lo := mload(add(uniform, 128))
        }

        // Reduce each 64-byte chunk mod p → 48-byte field element
        bytes memory fp0 = _modP(u0hi, u0lo);
        bytes memory fp1 = _modP(u1hi, u1lo);

        // MAP_FP_TO_G1 expects 64-byte input: [16 zero bytes][48-byte field element]
        (bool ok1, bytes memory P1) = MAP_FP_TO_G1.staticcall(abi.encodePacked(bytes16(0), fp0));
        require(ok1 && P1.length == 128, "map_fp_to_g1 #1");

        (bool ok2, bytes memory P2) = MAP_FP_TO_G1.staticcall(abi.encodePacked(bytes16(0), fp1));
        require(ok2 && P2.length == 128, "map_fp_to_g1 #2");

        // H = P1 + P2
        (bool ok3, bytes memory H) = G1ADD.staticcall(abi.encodePacked(P1, P2));
        require(ok3 && H.length == 128, "g1add");

        return H;
    }

    // RFC 9380 §5.3.1 - expand_message_xmd with SHA-256, output 128 bytes
    // ell = ceil(128/32) = 4 → produces b1||b2||b3||b4
    function _expandMessageXmd(bytes memory msg) internal view returns (bytes memory) {
        bytes memory DST_prime = abi.encodePacked(DST, uint8(DST.length));

        // msg_prime = Z_pad(64) || msg || I2OSP(128,2) || I2OSP(0,1) || DST_prime
        bytes32 b0 = sha256(abi.encodePacked(new bytes(64), msg, uint16(128), uint8(0), DST_prime));

        bytes32 b1 = sha256(abi.encodePacked(b0, uint8(1), DST_prime));
        bytes32 b2 = sha256(abi.encodePacked(b0 ^ b1, uint8(2), DST_prime));
        bytes32 b3 = sha256(abi.encodePacked(b0 ^ b2, uint8(3), DST_prime));
        bytes32 b4 = sha256(abi.encodePacked(b0 ^ b3, uint8(4), DST_prime));

        return abi.encodePacked(b1, b2, b3, b4); // 128 bytes
    }

    // Reduce a 64-byte big-endian integer mod p using the modexp precompile (0x05).
    // Returns 48 bytes (the field element).
    function _modP(bytes32 hi, bytes32 lo) internal view returns (bytes memory) {
        (bool ok, bytes memory result) = MODEXP.staticcall(
            abi.encodePacked(
                uint256(64), // base_len  = 64 bytes
                uint256(1), // exp_len   = 1 byte
                uint256(48), // mod_len   = 48 bytes (p)
                hi,
                lo, // base      = 64 bytes
                uint8(1), // exp       = 1
                FP_MODULUS // mod       = p (48 bytes)
            )
        );
        require(ok, "modexp");
        return result; // exactly 48 bytes
    }
}
