// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {SmokeConsumer} from "../src/contracts/SmokeConsumer.sol";

contract DeploySmoke is Script {
    function run() external {
        address adapter = vm.envAddress("SMOKE_ADAPTER");

        vm.startBroadcast();
        SmokeConsumer consumer = new SmokeConsumer(adapter);
        vm.stopBroadcast();

        console.log("SmokeConsumer:", address(consumer));
        console.log("adapter:      ", adapter);
    }
}
