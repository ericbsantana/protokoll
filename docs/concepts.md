# Concepts Reference

Everything that went into building <span class="brand">protokoll</span>, from mathematical primitives to EVM standards. Each concept builds on the previous.

---

## Part 1 - Number Systems

### Groups

A **group** is a set with one operation that satisfies four rules:

- **Closure**: combining two elements gives another element in the set
- **Associativity**: `(a + b) + c = a + (b + c)`
- **Identity**: there exists a `0` such that `a + 0 = a`
- **Inverse**: for every `a` there exists `-a` such that `a + (-a) = 0`

The integers under addition form a group. So do the non-zero rationals under multiplication.

Groups are the foundation of all public-key cryptography.

---

### GF(p) - Finite Fields

A **finite field** (also called a Galois field) is a set with a finite number of elements where addition, subtraction, multiplication, and division all work and stay within the set.

`GF(p)` is the field of integers modulo a prime `p`:

```
{0, 1, 2, ..., p−1}
```

All operations wrap around at `p`:

```
5 + 3 = 8     in the integers
5 + 3 = 0     in GF(7)   because 8 mod 7 = 1... wait: 8 mod 7 = 1
```

**Division** is defined via modular inverse. The inverse of `a` is the number `a⁻¹` such that `a · a⁻¹ ≡ 1 mod p`. It always exists when `p` is prime (and `a ≠ 0`).

**Fermat's little theorem** gives us a formula: `a⁻¹ = a^(p−2) mod p`.

In <span class="brand">protokoll</span>: all coordinate arithmetic on BLS12-381 happens in `GF(p)` where `p` is the 381-bit BLS12-381 field prime.

---

### The Discrete Logarithm Problem (DLP)

Given a group with generator `G`, the operation `k·G` (adding `G` to itself `k` times) is easy to compute in `O(log k)` steps.

The reverse - given `Y = k·G`, find `k` - is computationally infeasible for large groups. This is the **discrete logarithm problem**, and it is the one-way function underlying all of modern public-key cryptography.

```
Y = k·G     ← easy (milliseconds)
k = ?       ← hard (millions of years)
```

---

## Part 2 - Elliptic Curves

### Elliptic Curves over GF(p)

An elliptic curve over `GF(p)` is the set of points `(x, y)` satisfying:

```
y² = x³ + ax + b  (mod p)
```

plus a special point called **infinity** (the identity element).

These points form a group under the **chord-and-tangent rule**:

- To add two distinct points: draw the line through them, find the third intersection with the curve, reflect over the x-axis.
- To double a point: use the tangent line at that point.
- The identity is the point at infinity.

In <span class="brand">protokoll</span>: the curve is `y² = x³ + 4 mod p` (the BLS12-381 G1 curve).

---

### BLS12-381

BLS12-381 is a specific elliptic curve designed for cryptographic pairings, chosen for efficiency and security. Its parameters:

```
Field prime:
p = 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab

Curve order (size of G1):
n = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001

Equation: y² = x³ + 4

Generator G:
x = 0x17f1d3a73197d794...
y = 0x08b3f481e3aaa0f1...
```

Two primes are in play:
- `p` (~381 bits) - governs the coordinate arithmetic
- `n` (~255 bits) - the order of the G1 subgroup; governs scalar arithmetic

---

### G1 Subgroup and Cofactor Clearing

The full curve has more points than just the G1 subgroup. The ratio is the **cofactor** `h`:

```
total curve points = n × h
G1 = prime-order subgroup of size n
```

For BLS12-381, `h ≈ 2^30`. A random point on the curve has order `n·h`, not `n`. Scalar multiplication by `k` is only well-defined mod `n` for points in G1.

**Cofactor clearing**: multiplying any curve point by `h` maps it into G1. Required whenever we derive a curve point from a hash (the point might land anywhere on the curve).

---

## Part 3 - Hash-to-Curve

### Why Naive Hashing Fails

The obvious approach: `hash(input) → x`, check if `y² = x³ + 4` has a solution.

Problems:
- Only about half of x-values have a valid `y` (Euler's criterion determines this)
- The number of iterations is random → timing leak
- The distribution is not uniform - some points are hit more often than others

This is the **try-and-increment** method. Used in <span class="brand">protokoll</span> for the pedagogical implementation (`src/math/vrf.ts`) but not for production.

---

### SWU Algorithm (RFC 9380)

The **Simplified Shallue-Woestijne-Ulas (SWU)** algorithm maps a field element to a curve point in **one deterministic step**, with a provably uniform distribution.

The full hash-to-curve pipeline per RFC 9380:

```
msg (arbitrary bytes)
    │
    ▼
expand_message_xmd(msg, DST, 128)
    │  → 128 bytes of uniform randomness
    │    using HKDF-like construction with SHA-256
    │
    ├─ first 64 bytes → reduce mod p → u0
    └─ last  64 bytes → reduce mod p → u1
                │
                ▼
    SWU_map(u0) → P1    (with cofactor clearing)
    SWU_map(u1) → P2    (with cofactor clearing)
                │
                ▼
    H = P1 + P2         (uniform point in G1)
```

Two field elements are mapped and added to remove any bias from a single map.

---

### expand_message_xmd

The expansion function from RFC 9380 §5.3.1. Produces `L` uniform bytes from an arbitrary message using SHA-256:

```
DST_prime = DST || len(DST)            (domain separation)
b0 = SHA256(zeros(64) ‖ msg ‖ L ‖ 0 ‖ DST_prime)
b1 = SHA256(b0 ‖ 1 ‖ DST_prime)
b2 = SHA256(XOR(b0, b1) ‖ 2 ‖ DST_prime)
b3 = SHA256(XOR(b0, b2) ‖ 3 ‖ DST_prime)
b4 = SHA256(XOR(b0, b3) ‖ 4 ‖ DST_prime)

output = b1 ‖ b2 ‖ b3 ‖ b4   (128 bytes)
```

The DST (domain separation tag) ensures outputs from different protocols don't collide. In <span class="brand">protokoll</span>: `"protokoll-v1"`.

---

## Part 4 - The VRF Construction

### What is a VRF?

A **Verifiable Random Function** is a function `F(k, x) → (y, proof)` with three properties:

- **Uniqueness**: for a given `(k, x)`, there is only one valid output `y`
- **Pseudorandomness**: `y` looks indistinguishable from random to anyone without `k`
- **Verifiability**: anyone with the public key can verify that `y = F(k, x)` without knowing `k`

---

### Sigma Protocols

A **Sigma protocol** is a 3-move interactive proof:

```
Prover                    Verifier
  │                           │
  │  commit (U, V)            │
  │──────────────────────────▶│
  │                           │  random challenge c
  │◀──────────────────────────│
  │  response s               │
  │──────────────────────────▶│
  │                           │  accept/reject
```

The prover commits before seeing the challenge, so they cannot adapt their commitment to the challenge. This is the binding property.

---

### Fiat-Shamir Transform

Makes a Sigma protocol **non-interactive** by replacing the verifier's random challenge with a hash:

```
c = H(transcript so far)
```

The prover computes `c` themselves using a hash function. In the random oracle model, this is as secure as the interactive version because the hash output is unpredictable before the commitment is fixed.

In <span class="brand">protokoll</span>: `c = sha256(G ‖ Y ‖ H ‖ γ ‖ U ‖ V)`

---

### DLEQ Proof

A **Discrete Log Equality** proof shows that two public values share the same discrete logarithm, without revealing it.

Given `Y = k·G` and `γ = k·H`, prove `log_G(Y) = log_H(γ)`:

```
Proof generation:
  r  ← random nonce
  U  = r·G
  V  = r·H
  c  = sha256(G ‖ Y ‖ H ‖ γ ‖ U ‖ V)
  s  = r − c·k  mod n
  proof = (γ, c, s)

Verification:
  U' = s·G + c·Y     (expands to r·G = U)
  V' = s·H + c·γ     (expands to r·H = V)
  c' = sha256(G ‖ Y ‖ H ‖ γ ‖ U' ‖ V')
  accept iff c' = c
```

Why the expansion works:

```
s·G + c·Y = (r − c·k)·G + c·(k·G) = r·G = U  ✓
s·H + c·γ = (r − c·k)·H + c·(k·H) = r·H = V  ✓
```

---

## Part 5 - EVM Standards

### EIP-2537 - BLS12-381 Precompiles

EIP-2537 adds native BLS12-381 operations as EVM precompiled contracts, avoiding the need for expensive Solidity implementations.

| Address | Name | Input | Output | Gas |
|---------|------|-------|--------|-----|
| `0x0b` | BLS12\_G1ADD | 256 bytes (2 points) | 128 bytes (1 point) | ~500 |
| `0x0c` | BLS12\_G1MSM | 160 bytes × k (point + scalar pairs) | 128 bytes | variable |
| `0x10` | BLS12\_MAP\_FP\_TO\_G1 | 64 bytes (field element) | 128 bytes (G1 point) | ~5,500 |

All points use **EIP-2537 encoding**: 64 bytes per coordinate, where the first 16 bytes are zero padding and the last 48 bytes are the actual value (big-endian).

```
[00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00]  ← 16 zero bytes
[xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx   ← 48 bytes
 xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx
 xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx xx]
```

---

### Modexp Precompile (0x05)

Standard EVM precompile for arbitrary-precision modular exponentiation: `base^exp mod mod`.

Used in <span class="brand">protokoll</span> to reduce 64-byte hash outputs modulo the 381-bit BLS12-381 field prime. Standard Solidity arithmetic only supports 256-bit integers, so this precompile is essential for handling the larger field.

```
modexp(x, 1, p)  =  x mod p   (for any size x, p)
```

---

### RFC 9380 - Hashing to Elliptic Curves

The IETF standard for deterministically mapping arbitrary byte strings to elliptic curve points. Specifies:

- `hash_to_field`: expand arbitrary bytes into field elements using `expand_message_xmd`
- `map_to_curve`: map a field element to a curve point using SWU
- Cofactor clearing to ensure the result is in the prime-order subgroup

<span class="brand">protokoll</span> uses the BLS12-381 G1 variant with SHA-256 (the `_XMD:SHA-256_SSWU_RO_` suite). The `@noble/curves` TypeScript library and the `MAP_FP_TO_G1` precompile both implement this standard, ensuring the oracle and the contract always derive the same `H` from the same `roundId`.

---

## Part 6 - Implementation Steps

### Step 1 - Field Arithmetic (`src/math/field.ts`)

GF(p) operations from scratch: mod, add, sub, mul, pow (square-and-multiply), inv (Fermat's little theorem). No dependencies.

---

### Step 2 - Curve Operations (`src/math/curve.ts`)

BLS12-381 G1 point operations: `isOnCurve`, `negate`, `double` (tangent), `add` (chord), `scalarMul` (double-and-add, reduces scalar mod `n`). No dependencies beyond `field.ts`.

---

### Step 3 - VRF Proof (`src/math/vrf.ts`)

Pedagogical DLEQ proof: `generateProof` and `verifyProof`. Uses try-and-increment hash-to-curve with cofactor clearing. Pure TypeScript - no blockchain dependencies. 57 tests.

---

### Step 4 - Precompile Validation (`script/ValidatePrecompiles.s.sol`)

Before writing any Solidity verifier, confirmed that EIP-2537 precompiles (0x0b, 0x0c, 0x10) are live and correct on Monad testnet. Verified `1·G = G` using G1MSM.

---

### Step 5 - On-Chain Verifier (`src/contracts/MonadVRFVerifier.sol`)

Solidity DLEQ verifier using EIP-2537 precompiles. Implements `expand_message_xmd` (5× SHA-256), `_modP` (modexp 0x05), and `_hashToCurve` (0x10 × 2 + 0x0b). Takes `roundId` - computes `H` on-chain. No trust assumption on the oracle.

---

### Step 6 - Oracle Proof Module (`src/oracle/proof.ts`)

Production proof generation using `@noble/curves` for RFC 9380 hash-to-curve. EIP-2537 128-byte point encoding throughout. DST matches the Solidity constant `"protokoll-v1"`. Cross-layer verified: proofs generated here pass `MonadVRFVerifier` on-chain.

---

### Step 7 - Adapter Contract (`src/contracts/MonadVRFAdapter.sol`)

Request/fulfill coordinator. Stores pending requests, verifies proofs by delegating to `MonadVRFVerifier`, delivers `β = sha256(γ)` to the consumer via callback. Implements checks-effects-interactions pattern. Replay protection via `fulfilled` mapping.

---

### Step 8 - Oracle Service (`src/oracle/service.ts`)

TypeScript process that polls Monad testnet for `RandomnessRequested` events using `getLogs` (max 20-block range to avoid RPC limits), generates proofs, and submits `fulfill` transactions via viem. Idempotent - checks on-chain state before submitting.

---

## Glossary

| Term | Definition |
|------|-----------|
| **GF(p)** | Finite field of integers mod prime `p` |
| **Elliptic curve** | Set of points satisfying `y² = x³ + ax + b mod p`, forming a group |
| **G1** | The prime-order subgroup of BLS12-381 used for VRF operations |
| **Generator G** | Fixed public point; the "1" of the G1 group |
| **Scalar multiplication** | `k·P` = adding `P` to itself `k` times |
| **DLP** | Discrete Log Problem - given `Y = k·G`, finding `k` is infeasible |
| **Private key** | Secret scalar `k` |
| **Public key** | `Y = k·G`, published and registered on-chain |
| **VRF** | Verifiable Random Function - deterministic, pseudorandom, publicly verifiable |
| **DLEQ** | Discrete Log Equality - proves `log_G(Y) = log_H(γ)` without revealing `k` |
| **Sigma protocol** | 3-move interactive proof: commit → challenge → response |
| **Fiat-Shamir** | Collapses interactive proof to non-interactive using a hash as the challenge |
| **Nonce r** | Random per-proof scalar; must never be reused |
| **γ (gamma)** | VRF output point: `γ = k·H` |
| **β (beta)** | Final random output: `β = sha256(γ)` |
| **H** | Hash-to-curve result: `H = hash_to_curve(roundId)` |
| **Cofactor** | Ratio between full curve order and G1 order; clearing maps any point into G1 |
| **SWU** | Simplified Shallue-Woestijne-Ulas - deterministic hash-to-curve algorithm |
| **RFC 9380** | IETF standard for hashing to elliptic curves |
| **EIP-2537** | EVM standard adding BLS12-381 precompiles |
| **DST** | Domain Separation Tag - prevents cross-protocol hash collisions |
| **EIP-2537 encoding** | 128-byte point format: `[16 zero][48-byte x][16 zero][48-byte y]` |
| **Precompile** | Native EVM function at a fixed address; much cheaper than equivalent Solidity |
