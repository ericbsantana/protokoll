// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IRandomnessAdapter} from "../../src/contracts/interfaces/IRandomnessAdapter.sol";
import {MonadVRFAdapter} from "../../src/contracts/MonadVRFAdapter.sol";

contract MockConsumer is IRandomnessAdapter {
    MonadVRFAdapter public immutable adapter;

    bytes32 public lastRoundId;
    bytes32 public lastBeta;

    constructor(address adapter_) {
        adapter = MonadVRFAdapter(adapter_);
    }

    function requestRandomness(bytes32 roundId) external {
        adapter.requestRandomness(roundId);
    }

    function fulfillRandomness(bytes32 roundId, bytes32 beta) external override {
        lastRoundId = roundId;
        lastBeta    = beta;
    }
}
