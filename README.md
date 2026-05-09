<h1 align="center">protokoll</h1>

[![tests](https://github.com/ericbsantana/protokoll/actions/workflows/test.yml/badge.svg)](https://github.com/ericbsantana/protokoll/actions/workflows/test.yml)
[![release](https://img.shields.io/github/v/tag/ericbsantana/protokoll?label=release&color=blue)](https://github.com/ericbsantana/protokoll/tags)
[![stars](https://img.shields.io/github/stars/ericbsantana/protokoll?style=flat&color=yellow)](https://github.com/ericbsantana/protokoll/stargazers)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![solidity](https://img.shields.io/badge/solidity-0.8.28-363636?logo=solidity)](packages/protokoll/src/contracts)
[![network](https://img.shields.io/badge/network-Monad%20testnet-9333ea)](https://docs.protokoll.dev/guide/deployments)

An EC-VRF oracle for EVM chains. The oracle runs off-chain under a single BLS12-381 key and the on-chain verifier checks the DLEQ proof against the EIP-2537 precompiles. One key holder, no committee, no DKG.

Docs and theory walkthrough: **[docs.protokoll.dev](https://docs.protokoll.dev)**

---

## Live deployment

| Contract           | Address                                      |
|--------------------|----------------------------------------------|
| `MonadVRFVerifier` | `0x4b3fDB4bdE739B75b697751B81690707c0F1940B` |
| `MonadVRFAdapter`  | `0xa327402C4eED5862adC123b9b1b93acA475C4668` |

Chain ID `10143`. Request fee `0.08 MON`, paid to whoever submits the matching `fulfill` transaction. Anyone can fulfill; the proof itself is the authorization. See [docs/guide/deployments](https://docs.protokoll.dev/guide/deployments) for verification commands and earlier addresses.

## Integrate

A consumer just needs to forward `requestFee` to the adapter and implement `fulfillRandomness(bytes32, bytes32)`:

```solidity
pragma solidity 0.8.28;

interface IAdapter {
    function requestRandomness(bytes32 roundId) external payable;
    function requestFee() external view returns (uint256);
}

contract Game {
    IAdapter constant ADAPTER = IAdapter(0xa327402C4eED5862adC123b9b1b93acA475C4668);

    function play(bytes32 roundId) external payable {
        ADAPTER.requestRandomness{value: ADAPTER.requestFee()}(roundId);
    }

    function fulfillRandomness(bytes32 roundId, bytes32 beta) external {
        require(msg.sender == address(ADAPTER));
        // `beta` is the 32-byte random output for `roundId`. Use it.
    }
}
```

The adapter forwards at most 200 000 gas to the callback, so keep it small.

For TypeScript projects, [`@protokoll-eth/abi`](packages/abi) ships the typed ABIs and the active deployment addresses:

```ts
import { monadVrfAdapterAbi, activeDeployment } from '@protokoll-eth/abi'
```

## How it works

For oracle private key `k` and a 32-byte `roundId`:

```
H = hash_to_curve(roundId)        // RFC 9380 SWU on G1
γ = k · H                         // VRF output point
β = sha256(eip2537_encode(γ))     // 32-byte random output
```

The proof `(γ, c, s)` is a Chaum-Pedersen DLEQ. It shows `γ` came from the public key `Y = k·G` without revealing `k`. On-chain, `MonadVRFVerifier` recomputes `H` via `MAP_FP_TO_G1` (0x10) and checks the DLEQ using `G1ADD` (0x0b) and `G1MSM` (0x0c). The DST is `"protokoll-v1"` and must stay byte-equal across the off-chain code and the contract.

Exactly one `β` is valid for each `(k, roundId)`. The verifier rejects anything else. The [whitepaper](https://docs.protokoll.dev/whitepaper) has the security argument.

## Project layout

```
packages/
  protokoll/        @protokoll/core - contracts, oracle, math
    src/
      contracts/    Solidity verifier, adapter, consumer interface
      oracle/       TypeScript proof generation + viem-based service
      math/         BLS12-381 from scratch (used by tests)
      scripts/      keygen, fixture refresh, ad-hoc proof emission
    script/         Forge deploy scripts
    test/           Foundry tests (Solidity) + vitest tests (TypeScript)
    foundry.toml
  docs/             @protokoll/docs - VitePress site (docs.protokoll.dev)
  abi/              @protokoll-eth/abi - published ABIs and addresses for integrators
Makefile            One-command workflows
pnpm-workspace.yaml Workspace config
```

## Local development

```bash
git submodule update --init --recursive   # pulls forge-std under packages/protokoll/lib
pnpm install

make test                      # forge + vitest
make refresh                   # regenerate VRF fixtures, run tests, refresh gas snapshot
make keygen                    # mint a fresh oracle BLS12-381 keypair
make deploy-dryrun             # simulate a deploy against Monad testnet
make oracle                    # run the off-chain oracle service
```

`make help` lists every target. The Makefile picks the network, not your shell environment; override with `make NETWORK=mainnet ...`.

### Smoke test against the live deployment

```bash
make smoke-deploy                                          # deploys SmokeConsumer
make oracle &                                              # background-runs the oracle
make smoke-request CONSUMER=0x... ROUND=hello              # triggers a round
make smoke-status  CONSUMER=0x...                          # reads the result back
```

If `lastBeta` byte-equals the `beta=0x...` line printed in the oracle log, the round went end-to-end cleanly.

## License

MIT - see [LICENSE](LICENSE). Solidity and TypeScript sources also carry SPDX headers.
