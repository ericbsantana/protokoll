# Self-Hosting

Run your own <span class="brand">protokoll</span> oracle with your own BLS12-381 key pair. The contracts are permissionless - anyone can deploy their own `MonadVRFAdapter` and run a node against it.

## Prerequisites

- Node.js 20+
- A funded wallet on Monad testnet (for gas)
- [Foundry](https://getfoundry.sh) (for contract deployment)

## 1. Generate a key pair

Generate a random BLS12-381 private key scalar `k`. Any non-zero integer less than the curve order works. Store it securely - never commit it.

Then derive the public key `Y = k·G`:

```bash
# k is your private key as a decimal integer
ORACLE_K=<your_k> npx tsx src/scripts/pubkey.ts
```

This prints the 128-byte EIP-2537 encoded public key. Save this - you'll need it for the deploy step.

## 2. Deploy your own adapter

Deploy `MonadVRFVerifier` and `MonadVRFAdapter` with your public key:

```bash
# Set your deployer key
export PRIVATE_KEY=0x...

forge script script/Deploy.s.sol \
  --rpc-url https://testnet-rpc.monad.xyz \
  --broadcast \
  --sig "run(bytes)" \
  <your_128_byte_pubkey_hex>
```

Note the deployed addresses for the next step.

## 3. Configure the oracle

Create a `.env` file (never commit this):

```bash
# Your BLS12-381 private key (decimal integer)
ORACLE_K=<your_k>

# The Ethereum private key used to sign fulfillment transactions
ORACLE_PRIVATE_KEY=0x<your_eth_private_key>

# Your deployed MonadVRFAdapter address
ADAPTER_ADDRESS=0x<your_adapter_address>
```

## 4. Run the oracle

Build and start the oracle service:

```bash
npm run build
source .env
node dist/src/oracle/index.js
```

Expected output:

```
[oracle] started - adapter=0x... scanning from block 1234567
[oracle] poll - block=1234568 scanning=1234547–1234568
[oracle] getLogs returned 0 event(s)
```

When a `RandomnessRequested` event is detected:

```
[oracle] generating proof for roundId=0x...
[oracle] fulfilled roundId=0x... beta=0x... tx=0x...
```

## Key security

- `ORACLE_K` is the BLS12-381 private key. Exposure allows anyone to impersonate your oracle and submit valid proofs.
- `ORACLE_PRIVATE_KEY` is the Ethereum signing key for transactions. Exposure allows draining of the oracle wallet.
- The oracle never logs either key. Keep `.env` out of version control.
- The nonce `r` used in each proof is randomly generated per call using `crypto.getRandomValues`. Reusing `r` would allow recovery of `k` - the implementation prevents this by design.

## Monitoring

The oracle is intentionally simple: it polls for events and submits proofs. It logs every poll cycle, every proof generated, and every transaction hash.

Pipe to a log file and tail it:

```bash
node dist/src/oracle/index.js >> oracle.log 2>&1 &
tail -f oracle.log
```

Restart on failure:

```bash
while true; do
  node dist/src/oracle/index.js
  echo "[restart] oracle exited, restarting in 5s..."
  sleep 5
done
```

## Using the hosted oracle

If you don't want to run your own node, the <span class="brand">protokoll</span> hosted oracle watches the <ActiveVersion /> adapter on Monad testnet. See [Deployments](/guide/deployments) for the address and public key.

The hosted oracle runs on a best-effort basis for testnet. For mainnet, self-hosting is recommended.
