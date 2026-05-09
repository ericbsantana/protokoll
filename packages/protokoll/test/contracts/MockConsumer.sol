// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IRandomnessAdapter} from "../../src/contracts/interfaces/IRandomnessAdapter.sol";
import {MonadVRFAdapter} from "../../src/contracts/MonadVRFAdapter.sol";

contract MockConsumer is IRandomnessAdapter {
    MonadVRFAdapter public immutable adapter;

    bytes32 public lastRoundId;
    bytes32 public lastBeta;

    constructor(address adapter_) {
        adapter = MonadVRFAdapter(adapter_);
    }

    function requestRandomness(bytes32 roundId) external payable {
        adapter.requestRandomness{value: msg.value}(roundId);
    }

    // Allow receiving native MON (e.g. for tests that fund the consumer up-front).
    receive() external payable {}

    function fulfillRandomness(bytes32 roundId, bytes32 beta) external virtual override {
        lastRoundId = roundId;
        lastBeta = beta;
    }
}

// Griefer: burns gas in the callback so we can verify the cap is enforced.
contract MockGriefer is MockConsumer {
    constructor(address adapter_) MockConsumer(adapter_) {}

    function fulfillRandomness(
        bytes32,
        /* roundId */
        bytes32 /* beta */
    )
        external
        pure
        override
    {
        // Unbounded loop - exhausts whatever gas the caller forwards.
        // With CALLBACK_GAS_LIMIT in place this OOGs the callback frame,
        // not the fulfill() outer frame.
        uint256 i;
        while (true) {
            unchecked {
                i++;
            }
        }
    }
}

// Reverter: reverts in the callback. fulfill() must succeed and emit
// callbackOk=false so off-chain monitors can detect the failure.
contract MockReverter is MockConsumer {
    constructor(address adapter_) MockConsumer(adapter_) {}

    function fulfillRandomness(
        bytes32,
        /* roundId */
        bytes32 /* beta */
    )
        external
        pure
        override
    {
        revert("intentional callback revert");
    }
}

// ReturnBomb: returns a huge byte array. Forces the EVM to allocate
// large returndata. fulfill() must NOT copy it into memory.
contract MockReturnBomb is MockConsumer {
    constructor(address adapter_) MockConsumer(adapter_) {}

    function fulfillRandomness(
        bytes32,
        /* roundId */
        bytes32 /* beta */
    )
        external
        pure
        override
    {
        // Build and return ~64 KB of data. Without the (0,0) output buffer in
        // the adapter's assembly call, this would cause a returndatacopy of
        // matching size in the caller frame, inflating gas dramatically.
        bytes memory bomb = new bytes(64 * 1024);
        assembly {
            return(add(bomb, 0x20), mload(bomb))
        }
    }
}
