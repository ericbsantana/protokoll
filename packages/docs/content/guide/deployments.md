# Deployments

## Monad Testnet

> Four builds have been deployed. **Use the v0.4.0 (fee bump) addresses.**
> v0.3.0 is still on-chain but no oracle fulfills it; its 0.001 MON
> request fee is ~25x below the actual cost of `fulfill` and is not
> economically sustainable. v0.2.0 is hash-locked to the legacy
> `randnad-v1` DST and will reject every proof produced by the current
> oracle (which uses `protokoll-v1`). v0.1.x is additionally vulnerable
> to roundId-squatting (C1) and has no fee or callback gas cap. Do not
> integrate against anything but v0.4.0.

### v0.4.0 - fee bump (0.08 MON) - **ACTIVE**

| Contract            | Address                                                              |
|---------------------|----------------------------------------------------------------------|
| `MonadVRFVerifier`  | <DeployedAddr version="v0.4.0" contract="verifier" />                 |
| `MonadVRFAdapter`   | <DeployedAddr version="v0.4.0" contract="adapter" />                  |

- **Chain ID:** 10143
- **RPC:** `https://testnet-rpc.monad.xyz`
- **Explorer:** [testnet.monadexplorer.com](https://testnet.monadexplorer.com)
- **Request fee:** `0.08 MON` (8 × 10¹⁶ wei) - paid to the fulfiller, not a treasury
- **DST:** `protokoll-v1` (must match `src/oracle/proof.ts`)

#### v0.4.0 deploy transactions

| Contract            | Transaction Hash                                                                                                                            |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0xdcb965be...`](https://testnet.monadexplorer.com/tx/0xdcb965be91f74afde6098dc35c7a30955b655721ed52ac84d7c12ec3016553d1) (block 30694924) |
| `MonadVRFAdapter`   | [`0xce704a97...`](https://testnet.monadexplorer.com/tx/0xce704a9718e0a1b7cdc1fbba2bac3b3c9be729d9479c282b5b338bf66e8da7a5) (block 30694926) |

Total deploy gas: 1 455 266 (≈0.150 MON @ 103 gwei).

On-chain state verified post-deploy via `make deploy-verify`:

```
requestFee()         → 80000000000000000  (0.08 MON ✓)
verifier()           → 0x4b3f...940B       (matches deployed verifier ✓)
CALLBACK_GAS_LIMIT() → 200000              (200k cap ✓)
oraclePublicKey()    → 128 bytes ✓
```

The constructor's G1MSM smoke check passed (otherwise the deploy would
have reverted with `InvalidPublicKey`), confirming the public key is on
curve and in the prime-order subgroup.

#### Why v0.4.0 was needed

A typical `fulfill` on Monad testnet costs around 250 000 gas at ~103
gwei, or ~0.025 MON of inclusion cost. The v0.3.0 fee of 0.001 MON
covered roughly 10 000 gas worth and left the oracle ~25x underwater
per request. 0.08 MON gives ~3x margin over typical and ~1.6x over the
worst case (callback griefing at the full 200 000 gas cap), so
fulfillment is self-incentivising at realistic gas prices.

Nothing under `src/contracts/` changed between v0.3.0 and v0.4.0 - this
is a redeploy of the same source with a different `requestFee_`
constructor argument. `MonadVRFAdapter.requestFee` is `immutable`, so
bumping it requires a fresh deploy. The verifier is redeployed
alongside the adapter to keep the address pair version-locked, matching
the v0.3.0 release shape.

The oracle public key is unchanged, so the off-chain oracle service
keeps running with the same `ORACLE_K` - only `ADAPTER_ADDRESS` is
swapped.

### Deprecated - v0.3.0 (fee insufficient to sustain oracle)

> Fee was 0.001 MON, ~25x below real fulfill cost. Replaced by v0.4.0.
> The contract is still on-chain but no oracle is watching it; new
> requests will sit pending forever.

| Contract            | Address                                                              |
|---------------------|----------------------------------------------------------------------|
| `MonadVRFVerifier`  | <DeployedAddr version="v0.3.0" contract="verifier" />                 |
| `MonadVRFAdapter`   | <DeployedAddr version="v0.3.0" contract="adapter" />                  |

#### v0.3.0 deploy transactions

| Contract            | Transaction Hash                                                                                                                            |
|---------------------|---------------------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0x943e2f9c...`](https://testnet.monadexplorer.com/tx/0x943e2f9c342e2f036fc2b53aa912ce5d48a522ff88672db572d63d49da01cf71) (block 30497591) |
| `MonadVRFAdapter`   | [`0xd29363c4...`](https://testnet.monadexplorer.com/tx/0xd29363c4cc5f39359b06c3b57ab22555c7b60fe7c317bc0fb157a6733a5faf68) (block 30497597) |

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

| Contract            | Address                                                              |
|---------------------|----------------------------------------------------------------------|
| `MonadVRFVerifier`  | <DeployedAddr version="v0.2.0" contract="verifier" />                 |
| `MonadVRFAdapter`   | <DeployedAddr version="v0.2.0" contract="adapter" />                  |

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

| Contract            | Address                                                              |
|---------------------|----------------------------------------------------------------------|
| `MonadVRFVerifier`  | <DeployedAddr version="v0.1.x" contract="verifier" />                 |
| `MonadVRFAdapter`   | <DeployedAddr version="v0.1.x" contract="adapter" />                  |

#### Deploy transactions (v0.1.x)

| Contract            | Transaction Hash                                                                                                             |
|---------------------|------------------------------------------------------------------------------------------------------------------------------|
| `MonadVRFVerifier`  | [`0xe705c78c...`](https://testnet.monadexplorer.com/tx/0xe705c78c7ac0ebbe694b91777ba0cedcfdf84d55fa014c75f881d7281293bb63) |
| `MonadVRFAdapter`   | [`0x53b0f7161d1f287bfc5967804a286ff051e3c959c5a6b12856cb6718f3524ba5`](https://testnet.monadexplorer.com/tx/0x53b0f7161d1f287bfc5967804a286ff051e3c959c5a6b12856cb6718f3524ba5) |

### Oracle public key (v0.4.0)

The oracle's BLS12-381 public key `Y = k·G`, encoded in EIP-2537 128-byte format:

```
0x00000000000000000000000000000000121c1a5610cc41c2d8fcf2c7c3f5bdbd
  56b309c5c1647f41972e8c4af0d9efd89568d3c75647f97fc4232fa431733b0f
  0000000000000000000000000000000006712894c9f3fee125eaade9896a9962
  8360623e36b8376ca9b526c3f6180f99c7ecdda7c4ceb3a1207acfa43a9f2dba
```

This key is set at deploy time and cannot be changed. All proofs submitted
to a given adapter must verify against the public key registered with that
adapter. v0.4.0 uses the same key as v0.3.0 (the bump is purely a fee
change), so the off-chain oracle's `ORACLE_K` did not rotate; only
`ADAPTER_ADDRESS` was swapped.

## Mainnet

Not yet deployed. Mainnet availability depends on the target chain enabling the EIP-2537 BLS12-381 precompiles (`0x0b`, `0x0c`, `0x10`). The Monad testnet deployment above is the current reference.

## Verifying addresses

You can verify the live v0.4.0 adapter's registered key from the command line:

```bash
cast call 0xa327402C4eED5862adC123b9b1b93acA475C4668 \
  'oraclePublicKey()(bytes)' --rpc-url https://testnet-rpc.monad.xyz
```

Or run `make deploy-verify ADAPTER=0xa327... VERIFIER=0x4b3f...` for a full
on-chain sanity check.

This returns the 128-byte EIP-2537 encoded public key, reconstructed from
four `bytes32 immutable` chunks. There is no setter - the value is fixed
at construction.
