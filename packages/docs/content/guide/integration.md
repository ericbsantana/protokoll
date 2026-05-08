# Integration

Add verifiable randomness to any EVM contract in three steps.

## 1. Implement the callback interface

Your contract receives randomness via a callback. Implement `fulfillRandomness`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IRandomnessAdapter {
    function fulfillRandomness(bytes32 roundId, bytes32 beta) external;
}

contract MyGame is IRandomnessAdapter {
    address public immutable adapter;
    mapping(bytes32 => bool) private pending;

    constructor(address adapter_) {
        adapter = adapter_;
    }

    function rollDice(bytes32 roundId) external {
        pending[roundId] = true;
        IMonadVRFAdapter(adapter).requestRandomness(roundId);
    }

    function fulfillRandomness(bytes32 roundId, bytes32 beta) external override {
        require(msg.sender == adapter, "only adapter");
        require(pending[roundId], "not pending");
        delete pending[roundId];

        // beta is your 32-byte random value
        uint256 roll = (uint256(beta) % 6) + 1;
        // ... use roll
    }
}

interface IMonadVRFAdapter {
    function requestRandomness(bytes32 roundId) external;
}
```

## 2. Call `requestRandomness`

```solidity
adapter.requestRandomness(roundId);
```

`roundId` is any `bytes32` you choose - it identifies the request. Use a meaningful value like `keccak256(abi.encodePacked("game-", gameId, "-round-", round))` to avoid collisions.

The adapter emits `RandomnessRequested(roundId, requester)`. The oracle watches for this event.

## 3. Receive `fulfillRandomness`

The oracle detects the event, generates a DLEQ proof off-chain, and calls `fulfill(roundId, gamma, c, s)` on the adapter. The adapter verifies the proof on-chain, derives `beta = sha256(gamma)`, and calls `fulfillRandomness(roundId, beta)` on your contract.

You do not need to do anything to trigger this - it happens automatically once the oracle sees the event.

## Deployed addresses

| Network | Adapter Address |
|---|---|
| Monad Testnet | <DeployedAddr contract="adapter" /> |

See [Deployments](/guide/deployments) for full details including the verifier address and oracle public key.

## Trust model

**The oracle cannot reroll.** For a given `(k, roundId)` pair, there is exactly one valid `beta`. Any attempt to submit a different value produces a proof that fails on-chain verification.

**The oracle can withhold.** A single-node oracle can refuse to fulfill a request. <span class="brand">protokoll</span> v1 is honest-but-lazy: the trust assumption is liveness, not correctness.

If a round is unfulfilled after an acceptable window, your contract should handle the stale state (e.g., void the round, allow a retry with a new `roundId`).

## `roundId` uniqueness

Each `roundId` can only be requested once. `requestRandomness` reverts with `AlreadyRequested` if the same `roundId` is used twice. Use a nonce or game-specific identifier to ensure uniqueness.
