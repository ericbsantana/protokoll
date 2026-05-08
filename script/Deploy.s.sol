// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MonadVRFVerifier} from "../src/contracts/MonadVRFVerifier.sol";
import {MonadVRFAdapter}  from "../src/contracts/MonadVRFAdapter.sol";

contract Deploy is Script {
    function run() external {
        bytes memory oraclePubKey = vm.envBytes("ORACLE_PUBLIC_KEY");
        // Flat fee per request, paid in MON (wei). Set REQUEST_FEE_WEI=0 for a free deployment.
        uint256 requestFee = vm.envOr("REQUEST_FEE_WEI", uint256(0));

        vm.startBroadcast();

        MonadVRFVerifier verifier = new MonadVRFVerifier();
        MonadVRFAdapter  adapter  = new MonadVRFAdapter(address(verifier), oraclePubKey, requestFee);

        vm.stopBroadcast();

        console.log("MonadVRFVerifier:", address(verifier));
        console.log("MonadVRFAdapter: ", address(adapter));
        console.log("requestFee (wei):", requestFee);
    }
}
