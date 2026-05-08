// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MonadVRFVerifier} from "../src/contracts/MonadVRFVerifier.sol";
import {MonadVRFAdapter}  from "../src/contracts/MonadVRFAdapter.sol";

contract Deploy is Script {
    function run() external {
        bytes memory oraclePubKey = vm.envBytes("ORACLE_PUBLIC_KEY");

        vm.startBroadcast();

        MonadVRFVerifier verifier = new MonadVRFVerifier();
        MonadVRFAdapter  adapter  = new MonadVRFAdapter(address(verifier), oraclePubKey);

        vm.stopBroadcast();

        console.log("MonadVRFVerifier:", address(verifier));
        console.log("MonadVRFAdapter: ", address(adapter));
    }
}
