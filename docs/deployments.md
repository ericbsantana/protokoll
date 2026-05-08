# Deployments

## Monad Testnet

> ⚠️ **Hardened-contract redeploy is pending.** The currently-deployed
> contracts below are the pre-hardening (v0.1.x) build. They are vulnerable
> to roundId-squatting (CVE-style C1) and have no fee or callback gas cap.
> **Do not integrate against these addresses.** New addresses will be
> populated here once the v0.2.0-security-hardening build is deployed.

### Pending — v0.2.0 (post-hardening, Phase SEC)

| Contract            | Address                                                |
|---------------------|--------------------------------------------------------|
| `MonadVRFVerifier`  | _pending redeploy_                                     |
| `MonadVRFAdapter`   | _pending redeploy_                                     |

Constructor changes for the new adapter:
- Oracle public key is passed as four `bytes32` chunks, not a single `bytes`.
- New `requestFee` parameter (uint256, in wei) — flat fee paid per request,
  forwarded to whoever submits the matching `fulfill`.
- Constructor reverts (`InvalidPublicKey`) on the all-zero key or any input
  that fails the EIP-2537 G1MSM subgroup check.

ABI changes:
- `requestRandomness(bytes32)` is now `payable`; `msg.value` MUST equal `requestFee`.
- `fulfill(...)` takes `address consumer` as its first argument.
- `RandomnessFulfilled` event has a fourth field, `bool callbackOk`,
  signalling whether the consumer's `fulfillRandomness` callback ran cleanly
  (false if it reverted or OOG'd against the 200 000-gas cap).
- New view: `requestKey(address consumer, bytes32 roundId) → bytes32`,
  used to look up `pendingRequests`, `fulfilled`, and `escrow`.
- New view: `oraclePublicKey()` returns the 128-byte EIP-2537 key
  (reconstructed from four immutable chunks).

See [`tasks/plan.md`](../tasks/plan.md) § "Security Hardening Plan (Phase SEC)"
for the full slice-by-slice rationale, and the commit log under
`fix(sec): S1..S5` for the exact changes.

### Deprecated — v0.1.x (pre-hardening)

> Vulnerable to roundId squatting; do not use.

| Contract            | Address                                                                                                |
|---------------------|--------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | `0xe7f01914d7547d08d155ba47ee9616ee7d504b21`                                                           |
| `MonadVRFAdapter`   | `0xf04f829a98a686893ba740260e37876725c89ed5`                                                           |

**Chain ID:** 10143
**RPC:** `https://testnet-rpc.monad.xyz`
**Explorer:** [testnet.monadexplorer.com](https://testnet.monadexplorer.com)

#### Deploy Transactions (v0.1.x)

| Contract            | Transaction Hash                                                                                                             |
|---------------------|------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0xe705c78c...`](https://testnet.monadexplorer.com/tx/0xe705c78c7ac0ebbe694b91777ba0cedcfdf84d55fa014c75f881d7281293bb63) |
| `MonadVRFAdapter`   | [`0x53b0f716...`](https://testnet.monadexplorer.com/tx/0x53b0f7161d1f287bfc5967804a286ff051e3c959c5a6b12856cb6718f3524ba5) |

#### Oracle Public Key (unchanged across redeploys)

The oracle's BLS12-381 public key `Y = k·G`, encoded in EIP-2537 128-byte format:

```
0x000000000000000000000000000000000ce3b57b791798433fd323753489cac9
  bca43b98deaafaed91f4cb010730ae1e38b186ccd37a09b8aed62ce23b699c48
  00000000000000000000000000000000008c346228e4482ec20a2bf7d5a2fe74e
  bf3c79b912d1b0ba977a873b66f7a9b8b42585a78c0c21d66da6a15767efdb1
```

This key is set at deploy time and cannot be changed. All proofs submitted
to a given adapter must verify against the public key registered with that
adapter. The hardened build keeps the same key so existing off-chain proof
generation works unchanged after the redeploy.

## Mainnet

Not yet deployed. Monad mainnet launch is pending. Testnet deployments are the current reference.

## Verifying Addresses

After the v0.2.0 redeploy, you can verify the adapter's registered key:

```solidity
MonadVRFAdapter(<new-adapter-address>).oraclePublicKey()
```

This returns the 128-byte EIP-2537 encoded public key, reconstructed from
four `bytes32 immutable` chunks. There is no setter — the value is fixed
at construction.
