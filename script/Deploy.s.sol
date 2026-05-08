// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MonadVRFVerifier} from "../src/contracts/MonadVRFVerifier.sol";
import {MonadVRFAdapter}  from "../src/contracts/MonadVRFAdapter.sol";

contract Deploy is Script {
    function run() external {
        bytes memory oraclePubKey = vm.envBytes("ORACLE_PUBLIC_KEY");
        require(oraclePubKey.length == 128, "ORACLE_PUBLIC_KEY must be 128 bytes (EIP-2537 G1)");

        // Flat fee per request, paid in MON (wei). Set REQUEST_FEE_WEI=0 for a free deployment.
        uint256 requestFee = vm.envOr("REQUEST_FEE_WEI", uint256(0));

        // Split the 128-byte PK into four bytes32 chunks for the immutable constructor.
        bytes32 pk0;
        bytes32 pk1;
        bytes32 pk2;
        bytes32 pk3;
        assembly {
            pk0 := mload(add(oraclePubKey, 0x20))
            pk1 := mload(add(oraclePubKey, 0x40))
            pk2 := mload(add(oraclePubKey, 0x60))
            pk3 := mload(add(oraclePubKey, 0x80))
        }

        vm.startBroadcast();

        MonadVRFVerifier verifier = new MonadVRFVerifier();
        MonadVRFAdapter  adapter  = new MonadVRFAdapter(
            address(verifier), pk0, pk1, pk2, pk3, requestFee
        );

        vm.stopBroadcast();

        console.log("MonadVRFVerifier:", address(verifier));
        console.log("MonadVRFAdapter: ", address(adapter));
        console.log("requestFee (wei):", requestFee);
    }
}
