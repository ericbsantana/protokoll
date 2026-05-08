# Deployments

## Monad Testnet

> Three builds have been deployed. **Use the v0.3.0 (DST rename) addresses.**
> v0.2.0 is hash-locked to the legacy `randnad-v1` DST and will reject every
> proof produced by the current oracle (which uses `protokoll-v1`). v0.1.x is
> additionally vulnerable to roundId-squatting (C1) and has no fee or
> callback gas cap. Do not integrate against anything but v0.3.0.

### v0.3.0 - DST rename (`protokoll-v1`) - **ACTIVE**

| Contract            | Address                                                |
|---------------------|--------------------------------------------------------|
| `MonadVRFVerifier`  | `0x540A336317274Aac36b8cf9B7510f428Bf3e49Cc`           |
| `MonadVRFAdapter`   | `0x9c46878D6736eDC7eAF135DB6B3B2A9Dab2A756F`           |

**Chain ID:** 10143
**RPC:** `https://testnet-rpc.monad.xyz`
**Explorer:** [testnet.monadexplorer.com](https://testnet.monadexplorer.com)
**Request fee:** `0.001 MON` (1 × 10¹⁵ wei) - paid to the fulfiller, not a treasury
**DST:** `protokoll-v1` (must match `src/oracle/proof.ts`)

#### v0.3.0 deploy transactions

| Contract            | Transaction Hash                                                                                                                            |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0x943e2f9c...`](https://testnet.monadexplorer.com/tx/0x943e2f9c342e2f036fc2b53aa912ce5d48a522ff88672db572d63d49da01cf71) (block 30497591) |
| `MonadVRFAdapter`   | [`0xd29363c4...`](https://testnet.monadexplorer.com/tx/0xd29363c4cc5f39359b06c3b57ab22555c7b60fe7c317bc0fb157a6733a5faf68) (block 30497597) |

Total deploy gas: 1 455 266 (≈0.1499 MON @ 103 gwei).

On-chain state verified post-deploy via `make deploy-verify`:

```
requestFee()         → 1000000000000000   (0.001 MON ✓)
verifier()           → 0x540A...49Cc       (matches deployed verifier ✓)
CALLBACK_GAS_LIMIT() → 200000              (200k cap ✓)
oraclePublicKey()    → 128 bytes ✓
```

The constructor's G1MSM smoke check passed (otherwise the deploy would
have reverted with `InvalidPublicKey`), confirming the public key is on
curve and in the prime-order subgroup.

#### Why v0.3.0 was needed

The Solidity verifier hashes `roundId` to a curve point with a domain
separation tag (DST) that is baked into the bytecode as a `bytes constant`.
v0.2.0 was deployed with `DST = "randnad-v1"`. When the project was renamed
to **protokoll**, both `MonadVRFVerifier.sol` and `src/oracle/proof.ts`
were updated to `"protokoll-v1"`. The off-chain oracle and the on-chain
verifier MUST agree on the DST byte-for-byte; otherwise `H = hash_to_curve(roundId)`
diverges and every proof fails verification. v0.3.0 redeploys the verifier
(and adapter, which wires the verifier address) with the new DST so the
two sides match again.

### Deprecated - v0.2.0 (`randnad-v1` DST)

> DST mismatch with the current off-chain oracle. Proofs will not verify.

| Contract            | Address                                                |
|---------------------|--------------------------------------------------------|
| `MonadVRFVerifier`  | `0xFb70863723D8a54a559A657416Cdb2068B1b9F9D`           |
| `MonadVRFAdapter`   | `0x7782a54741dd9Dac95a8a79F181EFB97Bac2Dd19`           |

#### v0.2.0 deploy transactions

| Contract            | Transaction Hash                                                                                                                            |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0x5095aa50...`](https://testnet.monadexplorer.com/tx/0x5095aa5079ae5b34a40a89d16e92c60d5d6a65111bab492d0875d47093fe5bf6) (block 30357672) |
| `MonadVRFAdapter`   | [`0x429a9d4a...`](https://testnet.monadexplorer.com/tx/0x429a9d4ad6884a50504a06cb982c23261d4306a03bb3327426855f19af70be4e) (block 30357678) |

Constructor changes vs v0.1.x (still applicable in v0.3.0):
- Oracle public key is passed as four `bytes32` chunks, not a single `bytes`.
- New `requestFee` parameter (uint256, in wei) - flat fee paid per request,
  forwarded to whoever submits the matching `fulfill`.
- Constructor reverts (`InvalidPublicKey`) on the all-zero key or any input
  that fails the EIP-2537 G1MSM subgroup check.

ABI changes vs v0.1.x (still applicable in v0.3.0):
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

#### Deploy transactions (v0.1.x)

| Contract            | Transaction Hash                                                                                                             |
|---------------------|------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0xe705c78c...`](https://testnet.monadexplorer.com/tx/0xe705c78c7ac0ebbe694b91777ba0cedcfdf84d55fa014c75f881d7281293bb63) |
| `MonadVRFAdapter`   | [`0x53b0f7161d1f287bfc5967804a286ff051e3c959c5a6b12856cb6718f3524ba5`](https://testnet.monadexplorer.com/tx/0x53b0f7161d1f287bfc5967804a286ff051e3c959c5a6b12856cb6718f3524ba5) |

### Oracle public key (v0.3.0)

The oracle's BLS12-381 public key `Y = k·G`, encoded in EIP-2537 128-byte format:

```
0x00000000000000000000000000000000121c1a5610cc41c2d8fcf2c7c3f5bdbd
  56b309c5c1647f41972e8c4af0d9efd89568d3c75647f97fc4232fa431733b0f
  0000000000000000000000000000000006712894c9f3fee125eaade9896a9962
  8360623e36b8376ca9b526c3f6180f99c7ecdda7c4ceb3a1207acfa43a9f2dba
```

This key is set at deploy time and cannot be changed. All proofs submitted
to a given adapter must verify against the public key registered with that
adapter. v0.3.0 uses a different key from v0.1.x / v0.2.0; the off-chain
oracle's `ORACLE_K` was rotated alongside the redeploy.

## Mainnet

Not yet deployed. Mainnet availability depends on the target chain enabling the EIP-2537 BLS12-381 precompiles (`0x0b`, `0x0c`, `0x10`). The Monad testnet deployment above is the current reference.

## Verifying addresses

You can verify the live v0.3.0 adapter's registered key from the command line:

```bash
cast call 0x9c46878D6736eDC7eAF135DB6B3B2A9Dab2A756F \
  'oraclePublicKey()(bytes)' --rpc-url https://testnet-rpc.monad.xyz
```

Or run `make deploy-verify ADAPTER=0x9c46... VERIFIER=0x540A...` for a full
on-chain sanity check.

This returns the 128-byte EIP-2537 encoded public key, reconstructed from
four `bytes32 immutable` chunks. There is no setter - the value is fixed
at construction.
