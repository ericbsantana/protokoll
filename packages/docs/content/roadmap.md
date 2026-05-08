# Roadmap

Planned work on protokoll, ordered roughly by proximity. Items are not dated and may be reordered.

---

## Status (v0.2.0)

- Solidity verifier for BLS12-381 EC-VRF, using EIP-2537 precompiles
- TypeScript oracle service that watches `RandomnessRequested` events and submits proofs
- `IRandomnessAdapter` interface for consumer contracts
- Deployed on Monad testnet, MIT-licensed

Current trust model: single-node oracle. The oracle cannot reroll outcomes but can withhold them.

---

## Near term

### Client SDKs

Language bindings that wrap the request/settle flow against `MonadVRFAdapter`. Planned languages, in order:

1. **TypeScript** (`@protokoll/client`) - viem-based, ships with typed events and ABI loading
2. **Rust** (`protokoll-client`) - alloy-based, async, no_std-compatible core
3. **Go** (`protokoll-client-go`) - go-ethereum bindings, context-aware

All three SDKs expose the same primitives: `requestRandomness`, `awaitOutcome`, `verifyProof`.

### Solidity helper library

Reusable contracts on top of `IRandomnessAdapter`:

- `RandomConsumerBase` - abstract contract handling the request/callback flow
- `WeightedDraw` - select `k` of `n` with weights, deterministic from `beta`
- `Shuffle` - Fisher-Yates over arbitrary arrays, seeded by `beta`

### One-click deploy

A single template (Foundry deploy script + `docker compose`) that takes an operator from clone to running oracle without manual key handling, RPC wiring, or contract address bookkeeping.

### Indexer and dashboard

Read-only service that indexes rounds, proofs, and outcomes from the chain and exposes:

- per-round proof and outcome lookup
- per-operator latency and reliability metrics
- in-browser proof re-verification

Self-hostable, open source.

---

## v2 - Threshold VRF

Replace the single-node oracle with `t-of-n` operators holding key shares. Any `t` operators can produce `beta`; fewer than `t` cannot. Removes the withholding attack present in v1.

BLS12-381 supports threshold signature aggregation natively, so the verifier contract requires minimal changes. The oracle service grows a coordination layer (DKG, share storage, partial-signature aggregation).

---

## Beyond

### Multi-chain

EIP-2537 is a general EVM precompile. The verifier is portable to any chain that supports the same precompile addresses. The oracle service is already chain-agnostic at the protocol level.

### Operator registry

On-chain registry of operators with metadata: identity, fees, historical reliability. Consumer contracts pick a provider by reputation and price. Open registration, no central allowlist.

### Reference applications

Example contracts that consume protokoll, intended as integration references:

- sealed-bid auction with random tie-breaking
- deterministic-shuffle NFT mint
- transparent lottery with on-chain proof of fairness
- leader election for rotating committees

---

## Contributing

Direction questions and proposals: open a [GitHub issue](https://github.com/ericbsantana/protokoll/issues). Code contributions: open a PR against `main`. Background reading: the [whitepaper](/whitepaper).
