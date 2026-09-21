// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

import {Script} from "forge-std/Script.sol";
import {IRegistry} from "@aztec/IRegistry.sol";
import {YacanaPortal} from "../src/YacanaPortal.sol";

/// Deploys the portal (which deploys YACA) with the fixed policy. Every input comes from the
/// environment: the deployer key is read here and never passed on a command line.
///   YACANA_L1_PRIVATE_KEY, YACANA_REGISTRY, YACANA_OPERATORS, YACANA_PER_HOUR, YACANA_ALLOWANCE,
///   YACANA_EXIT_FLOOR, YACANA_PAUSE_MAX, YACANA_PAUSE_BUDGET, YACANA_LAUNCH_BACKDATE, YACANA_LAUNCH_AHEAD,
///   YACANA_LEAF_GAS, YACANA_TOKEN_NAME, YACANA_TOKEN_SYMBOL
contract Deploy is Script {
  function run() external returns (address portal, address yaca) {
    uint256 key = vm.envUint("YACANA_L1_PRIVATE_KEY");
    YacanaPortal.Policy memory policy = YacanaPortal.Policy({
      perHour: uint128(vm.envUint("YACANA_PER_HOUR")),
      allowance: uint128(vm.envUint("YACANA_ALLOWANCE")),
      exitFloor: uint64(vm.envUint("YACANA_EXIT_FLOOR")),
      pauseMax: uint64(vm.envUint("YACANA_PAUSE_MAX")),
      pauseBudget: uint64(vm.envUint("YACANA_PAUSE_BUDGET")),
      launchBackdate: uint64(vm.envUint("YACANA_LAUNCH_BACKDATE")),
      launchAhead: uint64(vm.envUint("YACANA_LAUNCH_AHEAD")),
      leafGas: vm.envUint("YACANA_LEAF_GAS")
    });
    vm.startBroadcast(key);
    YacanaPortal deployed = new YacanaPortal(
      IRegistry(vm.envAddress("YACANA_REGISTRY")),
      vm.envAddress("YACANA_OPERATORS"),
      policy,
      vm.envString("YACANA_TOKEN_NAME"),
      vm.envString("YACANA_TOKEN_SYMBOL")
    );
    vm.stopBroadcast();
    portal = address(deployed);
    yaca = address(deployed.YACA_TOKEN());
  }
}
