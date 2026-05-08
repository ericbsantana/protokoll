# Deployments

## Monad Testnet

> Two builds have been deployed. **Use the v0.2.0 (post-hardening) addresses.**
> The v0.1.x addresses are kept here for reference only; they are vulnerable
> to roundId-squatting (C1) and have no fee or callback gas cap. Do not
> integrate against the v0.1.x adapter.

### v0.2.0 - post-hardening (Phase SEC) - **ACTIVE**

| Contract            | Address                                                |
|---------------------|--------------------------------------------------------|
| `MonadVRFVerifier`  | `0xFb70863723D8a54a559A657416Cdb2068B1b9F9D`           |
| `MonadVRFAdapter`   | `0x7782a54741dd9Dac95a8a79F181EFB97Bac2Dd19`           |

**Chain ID:** 10143
**RPC:** `https://testnet-rpc.monad.xyz`
**Explorer:** [testnet.monadexplorer.com](https://testnet.monadexplorer.com)
**Request fee:** `0.001 MON` (1 × 10¹⁵ wei) - paid to the fulfiller, not a treasury

#### v0.2.0 deploy transactions

| Contract            | Transaction Hash                                                                                                                            |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0x5095aa50...`](https://testnet.monadexplorer.com/tx/0x5095aa5079ae5b34a40a89d16e92c60d5d6a65111bab492d0875d47093fe5bf6) (block 30357672) |
| `MonadVRFAdapter`   | [`0x429a9d4a...`](https://testnet.monadexplorer.com/tx/0x429a9d4ad6884a50504a06cb982c23261d4306a03bb3327426855f19af70be4e) (block 30357678) |

Total deploy gas: 1 454 666 (≈0.1498 MON @ 103 gwei).

On-chain state verified post-deploy via `cast call`:

```
requestFee()         → 1000000000000000   (0.001 MON ✓)
verifier()           → 0xFb70...9F9D       (matches deployed verifier ✓)
CALLBACK_GAS_LIMIT() → 200000              (200k cap ✓)
oraclePublicKey()    → 128 bytes, identical to v0.1.x ✓
```

The constructor's G1MSM smoke check passed (otherwise the deploy would
have reverted with `InvalidPublicKey`), confirming the public key is on
curve and in the prime-order subgroup.

Constructor changes for the new adapter:
- Oracle public key is passed as four `bytes32` chunks, not a single `bytes`.
- New `requestFee` parameter (uint256, in wei) - flat fee paid per request,
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

See the commit log under `fix(sec): S1..S5` for the full rationale and exact changes.

### Deprecated - v0.1.x (pre-hardening)

> Vulnerable to roundId squatting; do not use.

| Contract            | Address                                                                                                |
|---------------------|--------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | `0xe7f01914d7547d08d155ba47ee9616ee7d504b21`                                                           |
| `MonadVRFAdapter`   | `0xf04f829a98a686893ba740260e37876725c89ed5`                                                           |

**Chain ID:** 10143
**RPC:** `https://testnet-rpc.monad.xyz`
**Explorer:** [testnet.monadexplorer.com](https://testnet.monadexplorer.com)

#### Deploy transactions (v0.1.x)

| Contract            | Transaction Hash                                                                                                             |
|---------------------|------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0xe705c78c...`](https://testnet.monadexplorer.com/tx/0xe705c78c7ac0ebbe694b91777ba0cedcfdf84d55fa014c75f881d7281293bb63) |
| `MonadVRFAdapter`   | [`0x53b0f716...`](https://testnet.monadexplorer.com/tx/0x53b0f7161d1f287bfc5967804a286ff051e3c959c5a6b12856cb6718f3524ba5) |

### Oracle public key (unchanged across redeploys)

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

Not yet deployed. Mainnet availability depends on the target chain enabling the EIP-2537 BLS12-381 precompiles (`0x0b`, `0x0c`, `0x10`). The Monad testnet deployment above is the current reference.

## Verifying addresses

You can verify the live v0.2.0 adapter's registered key from the command line:

```bash
cast call 0x7782a54741dd9Dac95a8a79F181EFB97Bac2Dd19 \
  'oraclePublicKey()(bytes)' --rpc-url https://testnet-rpc.monad.xyz
```

This returns the 128-byte EIP-2537 encoded public key, reconstructed from
four `bytes32 immutable` chunks. There is no setter - the value is fixed
at construction.
