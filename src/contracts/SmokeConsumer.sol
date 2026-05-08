// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IRandomnessAdapter} from "./interfaces/IRandomnessAdapter.sol";

interface IAdapter {
    function requestRandomness(bytes32 roundId) external payable;
    function requestFee() external view returns (uint256);
}

/// @notice Minimal consumer used to smoke-test a live deployment.
///         Records the most recent (roundId, beta) pair received from the
///         adapter callback so the round can be inspected with `cast call`.
contract SmokeConsumer is IRandomnessAdapter {
    IAdapter public immutable adapter;

    bytes32 public lastRoundId;
    bytes32 public lastBeta;
    bool public callbackReceived;

    error OnlyAdapter();

    constructor(address adapter_) {
        adapter = IAdapter(adapter_);
    }

    receive() external payable {}

    /// @notice Forward `requestFee` to the adapter and register a request.
    function request(bytes32 roundId) external {
        adapter.requestRandomness{value: adapter.requestFee()}(roundId);
    }

    /// @inheritdoc IRandomnessAdapter
    function fulfillRandomness(bytes32 roundId, bytes32 beta) external override {
        if (msg.sender != address(adapter)) revert OnlyAdapter();
        lastRoundId = roundId;
        lastBeta = beta;
        callbackReceived = true;
    }
}
