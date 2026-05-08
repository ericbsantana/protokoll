# randnad - Verifiable Randomness on Monad

## Abstract

randnad is a Verifiable Random Function (VRF) oracle built for Monad testnet. It produces random numbers that are provably unbiased, deterministic, and publicly verifiable - without trusting the oracle. The system is implemented from first principles: finite field arithmetic, elliptic curve group operations, and a non-interactive DLEQ proof, all the way up to a Solidity verifier that uses EIP-2537 precompiles for on-chain BLS12-381 operations.

---

## 1. The Problem

Blockchains are deterministic. Every node executes the same instructions and reaches the same state. This is what makes consensus possible - but it makes randomness impossible.

A smart contract that needs a random number (for a lottery, a game, a fair drop) cannot generate one itself. Everything it touches is public and reproducible. If it tries to use `block.timestamp` or `blockhash`, a miner or validator can manipulate these values.

The standard solution is an **oracle**: an off-chain service that generates randomness and delivers it on-chain. But this creates a new problem. How does the contract know the oracle didn't wait to see who placed what bets, then chose a convenient number?

A VRF solves this by making the oracle **commit to a process** before seeing any bets. The oracle publishes a public key. For each round, there is exactly one valid output - determined entirely by the oracle's private key and the round identifier. The oracle cannot deviate. Any attempt to change the output would produce an invalid proof that the contract would reject.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     MONAD TESTNET                        │
│                                                          │
│  ┌──────────────┐    ┌─────────────────┐                │
│  │   Consumer   │    │  MonadVRFAdapter │                │
│  │   Contract   │───▶│                 │                │
│  │              │◀───│  (coordinator)  │                │
│  └──────────────┘    └────────┬────────┘                │
│                               │ calls                   │
│                               ▼                         │
│                      ┌─────────────────┐                │
│                      │ MonadVRFVerifier │                │
│                      │                 │                │
│                      │  uses 0x0b 0x0c │                │
│                      │      0x05 0x10  │                │
│                      └─────────────────┘                │
└─────────────────────────────────────────────────────────┘
                               ▲
                               │ submits proof
                               │
                    ┌──────────┴──────────┐
                    │   Oracle Service    │
                    │   (TypeScript)      │
                    │                    │
                    │  watches events    │
                    │  generates proof   │
                    └─────────────────────┘
```

There are four components:

- **Consumer contract** - any on-chain application that needs randomness. Implements `IRandomnessAdapter` to receive the result.
- **MonadVRFAdapter** - the coordinator. Accepts requests, emits events, receives proofs, delivers results.
- **MonadVRFVerifier** - the math. Verifies a DLEQ proof using BLS12-381 precompiles.
- **Oracle service** - off-chain TypeScript process. Watches for requests and submits proofs.

---

## 3. The Request/Fulfill Flow

```
Consumer                Adapter               Verifier          Fulfiller
   │                      │                      │                 │
   │  requestRandomness   │                      │                 │
   │  {value: fee}        │                      │                 │
   │  ("round-5")         │                      │                 │
   │─────────────────────▶│                      │                 │
   │                      │ key = keccak(        │                 │
   │                      │   consumer,          │                 │
   │                      │   "round-5")         │                 │
   │                      │ store:               │                 │
   │                      │  pendingRequests[k]  │                 │
   │                      │   = true             │                 │
   │                      │  escrow[k] = fee     │                 │
   │                      │                      │                 │
   │                      │ emit:                │                 │
   │                      │  RandomnessRequested │                 │
   │                      │  ("round-5",         │                 │
   │                      │   consumer)          │                 │
   │                      │                      │    sees event   │
   │                      │                      │◀────────────────│
   │                      │                      │                 │
   │                      │                      │  generate proof │
   │                      │                      │  (γ, c, s)      │
   │                      │                      │                 │
   │                      │   fulfill(           │                 │
   │                      │    consumer,         │                 │
   │                      │    "round-5",        │                 │
   │                      │    γ, c, s)          │                 │
   │                      │◀─────────────────────────────────────│
   │                      │                      │                 │
   │                      │  verifyProof(        │                 │
   │                      │   Y, "round-5",      │                 │
   │                      │   γ, c, s)           │                 │
   │                      │─────────────────────▶│                 │
   │                      │                      │ compute H       │
   │                      │                      │ = 0x10("round-5")
   │                      │                      │                 │
   │                      │                      │ check proof ✓   │
   │                      │◀─────────────────────│                 │
   │                      │                      │                 │
   │                      │ β = sha256(γ)        │                 │
   │                      │ clear escrow[k],     │                 │
   │                      │   pending[k]         │                 │
   │                      │                      │                 │
   │  fulfillRandomness   │                      │                 │
   │  ("round-5", β)      │                      │                 │
   │  (≤200k gas)         │                      │                 │
   │◀─────────────────────│                      │                 │
   │                      │                      │  pay fee {value} │
   │                      │─────────────────────────────────────▶ │
   │                      │ emit:                │                 │
   │                      │  RandomnessFulfilled │                 │
   │                      │  (consumer,          │                 │
   │                      │   "round-5",         │                 │
   │                      │   β, callbackOk)     │                 │
```

**Key properties:**

- *Unforgeability.* `β = sha256(γ)` where `γ = k·H` and `H` is derived
  deterministically from the round ID on-chain. The only way to change `β`
  is to use a different `k`, which would fail verification against `Y`.
- *No squat redirection.* Storage is namespaced by `keccak(consumer, roundId)`,
  so a third party calling `requestRandomness("round-5")` first cannot
  redirect the legitimate consumer's callback. Two consumers can request
  the same `roundId` and be fulfilled independently with the same proof.
- *Self-incentivising fulfillment.* The fulfiller is paid the `requestFee`
  collected from the consumer. No admin role, no treasury withdrawal.
- *Bounded callback.* The consumer's `fulfillRandomness` is invoked through
  a low-level call capped at `CALLBACK_GAS_LIMIT = 200 000` gas, with the
  output buffer set to `(0,0)` so a return-bomb cannot inflate the
  fulfiller's gas. A failed callback is signalled via `callbackOk = false`
  in the event; the round is still marked fulfilled (no retry path).

---

## 4. Mathematical Foundation

### 4.1 The Elliptic Curve Group

randnad uses **BLS12-381**, a pairing-friendly elliptic curve defined over a 381-bit prime field GF(p). Points on the curve satisfy:

```
y² = x³ + 4  (mod p)
```

where

```
p = 0x1a0111ea397fe69a4b1ba7b6434bacd764774b84f38512bf6730d2a0f6b0f6241eabfffeb153ffffb9feffffffffaaab
```

The curve has a special subgroup G1 of prime order `n`:

```
n = 0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001
```

Within G1, addition is defined by the chord-and-tangent rule. Repeated addition defines scalar multiplication: `k·P` means adding `P` to itself `k` times. This is cheap to compute but impossible to reverse - the **discrete logarithm problem**.

### 4.2 The VRF Construction

The oracle holds a secret scalar `k`. It publishes:

```
Y = k·G
```

where `G` is the standard G1 generator. This is the public key.

For each round with identifier `roundId`:

1. **H = hash\_to\_curve(roundId)** - a public curve point, deterministic from the round ID
2. **γ = k·H** - the VRF output point. Only the oracle can compute this.
3. **β = sha256(γ)** - the final random output, delivered to the consumer.

`β` is unique for each `(k, roundId)` pair. Nobody can compute it without `k`, and the oracle cannot choose it freely - it is fully determined.

### 4.3 The DLEQ Proof

The contract needs to verify that the oracle used the same `k` in both:

```
Y = k·G   (public key)
γ = k·H   (output point)
```

This is a Discrete Logarithm Equality (DLEQ) proof. The oracle proves `log_G(Y) = log_H(γ)` without revealing `k`.

**Proof generation:**

```
1. Pick a random nonce r
2. U = r·G  and  V = r·H   (commitments)
3. c = sha256(G ‖ Y ‖ H ‖ γ ‖ U ‖ V)   (Fiat-Shamir challenge)
4. s = r − c·k  mod n                   (response)

Proof: (γ, c, s)
```

**Verification:**

```
1. Recompute H = hash_to_curve(roundId)
2. U' = s·G + c·Y
3. V' = s·H + c·γ
4. c' = sha256(G ‖ Y ‖ H ‖ γ ‖ U' ‖ V')
5. Accept iff c' == c
```

**Why it works:** Expand `U'`:

```
s·G + c·Y
= (r − c·k)·G + c·(k·G)
= r·G − c·k·G + c·k·G
= r·G = U ✓
```

And similarly `V' = V`. So the hash matches. An attacker without `k` cannot produce a valid `s`.

### 4.4 Fiat-Shamir Transform

The original proof is a 3-move interactive protocol (the prover sends U, V; the verifier sends a random challenge c; the prover responds with s). The **Fiat-Shamir transform** makes it non-interactive by replacing the verifier's random challenge with a hash of all prior messages:

```
c = sha256(G ‖ Y ‖ H ‖ γ ‖ U ‖ V)
```

This is secure in the random oracle model. The prover cannot manipulate `c` because they would need to predict the hash output before choosing their commitments.

---

## 5. On-Chain Verification

### 5.1 EIP-2537 Precompiles

EIP-2537 adds native BLS12-381 operations to the EVM as precompiled contracts:

| Address | Name | Operation | Gas |
|---------|------|-----------|-----|
| `0x0b` | BLS12\_G1ADD | Point addition | ~500 |
| `0x0c` | BLS12\_G1MSM | Multi-scalar multiplication | ~12,000 per call |
| `0x10` | BLS12\_MAP\_FP\_TO\_G1 | Field element → G1 point (SWU) | ~5,500 |

These replace what would otherwise require thousands of lines of Solidity and millions of gas.

### 5.2 Hash-to-Curve On-Chain (RFC 9380)

The verifier computes `H = hash_to_curve(roundId)` entirely on-chain. This is the critical trust-removal step - the oracle cannot pass a manipulated `H`.

The pipeline:

```
roundId (bytes32)
    │
    ▼
expand_message_xmd(roundId, DST, 128)    ← 5× SHA-256 (builtin)
    │
    ▼  128 bytes of uniform randomness
    │
    ├─ first 64 bytes → reduce mod p (modexp 0x05) → u0
    └─ last  64 bytes → reduce mod p (modexp 0x05) → u1
                │
                ▼
    MAP_FP_TO_G1(u0) → P1    ← precompile 0x10
    MAP_FP_TO_G1(u1) → P2    ← precompile 0x10
                │
                ▼
    G1ADD(P1, P2) → H        ← precompile 0x0b
```

`expand_message_xmd` is specified in RFC 9380. The oracle uses `@noble/curves` which implements the same algorithm. Both use the domain separation tag `"randnad-v1"`. This guarantees they produce the same `H` from the same `roundId`.

### 5.3 Full Verification Flow

```
INPUTS:  Y (public key), roundId, γ, c, s

STEP 1 - compute H on-chain
  expand_message_xmd(roundId) → u0, u1
  MAP_FP_TO_G1(u0) + MAP_FP_TO_G1(u1) → H

STEP 2 - reconstruct commitments
  U' = s·G + c·Y    via G1MSM (0x0c)
  V' = s·H + c·γ    via G1MSM (0x0c)

STEP 3 - recompute challenge
  c' = sha256(G ‖ Y ‖ H ‖ γ ‖ U' ‖ V') mod n

STEP 4 - accept iff c' == c
```

---

## 6. Trust Model

```
                 BEFORE (oracle passes H)
                 ────────────────────────
  Oracle says:  "H = this point"
  Contract:      OK, I'll use your H
                 ↑
                 TRUST THE ORACLE for H

                 AFTER (contract computes H)
                 ──────────────────────────
  Oracle says:  "here's my proof (γ, c, s)"
  Contract:      I'll compute H myself from roundId
                 Then verify the proof against that H
                 ↑
                 ZERO TRUST - math enforces correctness
```

The oracle is trusted for liveness (it must show up and submit proofs), but not for correctness. Any invalid proof is rejected. The random output `β` cannot be manipulated - it is fully determined by `k` and `roundId`.

---

## 7. Gas Analysis

Numbers below are from the v0.2.0 (post-hardening) Foundry suite.
Live testnet measurements will replace these once the hardened build is
deployed; see [`docs/deployments.md`](./deployments.md).

```
requestRandomness{value: fee}("round-5")     ~95,000 gas
  ├── keccak namespace key                    ~     500 gas
  ├── pendingRequests + escrow SSTOREs        ~ 44,000 gas
  └── event emission                          ~  3,000 gas

fulfill(consumer, "round-5", γ, c, s)       ~196,000 gas
  ├── hash-to-curve                           ~ 20,000 gas
  │     5× SHA-256 + 2× 0x10 + 0x0b
  ├── G1MSM × 2 (U', V')                     ~ 24,000 gas
  ├── SHA-256 for c'                          ~    500 gas
  ├── storage clear (pending, escrow)         ~  -5,000 gas (refunds capped)
  ├── capped callback (≤200,000 gas)          ~  ≤200,000
  └── fee transfer to fulfiller               ~  9,000 gas (new account)

Total per round (callback that just stores β): ~290,000 gas
```

The fee escrow path adds ~17 000 gas per round vs the v0.1.x build, in
exchange for closing the spam DoS. The 200 000-gas callback ceiling is
included in the fulfill total only if the consumer actually uses it; a
minimal callback (just store β, emit an event) costs ~30 000 gas.

At Monad testnet gas prices this remains a small fraction of a cent per
random number. The `requestFee` should be set to cover the fulfiller's
~290k gas with a small margin so fulfillment is self-incentivising.

---

## 8. Implementation Stack

| Layer | File | Description |
|-------|------|-------------|
| Field arithmetic | `src/math/field.ts` | GF(p) operations: add, mul, pow, inv |
| Curve operations | `src/math/curve.ts` | BLS12-381 G1: point add, scalar mul |
| VRF (pedagogical) | `src/math/vrf.ts` | DLEQ proof generation and verification |
| Oracle proof | `src/oracle/proof.ts` | Production proof with EIP-2537 encoding |
| Oracle service | `src/oracle/service.ts` | Chain watcher, proof submitter |
| On-chain verifier | `src/contracts/MonadVRFVerifier.sol` | DLEQ verification using precompiles |
| Coordinator | `src/contracts/MonadVRFAdapter.sol` | Request/fulfill flow |
| Consumer interface | `src/contracts/interfaces/IRandomnessAdapter.sol` | Callback interface |

**Test coverage:** 97 tests across TypeScript (vitest, 69) and Solidity
(Foundry, 28), including cross-layer integration tests where a
TypeScript-generated proof is verified by the Solidity contract, plus
adversarial coverage of the Phase SEC hardenings:

- C1 — `test_squatCannotRedirect`, `test_twoConsumersSameRoundId_…`
- H1 — `test_griefingConsumer_…`, `test_returnBomb_…`, `test_revertingConsumer_…`
- H3 — `test_fulfillerReceivesFee`, `test_reentrantFulfillFromFulfiller_reverts`
- M2 — `test_deployWithGarbagePK_reverts`, `test_deployWithIdentityPK_reverts`