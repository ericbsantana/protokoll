// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MonadVRFAdapter}  from "../src/contracts/MonadVRFAdapter.sol";

// Sends a requestRandomness() call to a deployed MonadVRFAdapter.
// The oracle service will detect the event and fulfill it.
//
// Usage:
//   ADAPTER_ADDRESS=0x... PRIVATE_KEY=0x... ROUND_ID=round-7 \
//     forge script script/RequestRandomness.s.sol --rpc-url monad_testnet --broadcast

contract RequestRandomness is Script {
    function run() external {
        address adapterAddr = vm.envAddress("ADAPTER_ADDRESS");
        string  memory id   = vm.envString("ROUND_ID");

        bytes32 roundId = bytes32(bytes(id));

        vm.startBroadcast();
        MonadVRFAdapter(adapterAddr).requestRandomness(roundId);
        vm.stopBroadcast();

        console.log("Requested randomness for round:", id);
        console.logBytes32(roundId);
    }
}
