// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {YacanaHashes} from "../src/YacanaHashes.sol";

/// The cross-language vectors packages/bridge pinned; the Noir crate asserts the same file.
contract HashesTest is Test {
  string internal json;

  function setUp() public {
    json = vm.readFile("../bridge/fixtures/bridge-vectors.json");
  }

  function field(string memory key) internal view returns (bytes32) {
    return bytes32(vm.parseJsonUint(json, key));
  }

  function testExitContent() public view {
    address recipient = vm.parseJsonAddress(json, ".exit.recipient");
    uint256 amount = vm.parseJsonUint(json, ".exit.amount");
    assertEq(YacanaHashes.exitContent(recipient, amount, field(".exit.tag")), field(".exit.value"));
  }

  function testSendAheadContent() public view {
    uint256 amount = vm.parseJsonUint(json, ".sendAhead.amount");
    address key = vm.parseJsonAddress(json, ".sendAhead.redeemKey");
    assertEq(YacanaHashes.sendAheadContent(amount, field(".sendAhead.secretHash"), key), field(".sendAhead.value"));
  }

  function testClaimContent() public view {
    assertEq(YacanaHashes.claimContent(vm.parseJsonUint(json, ".claim.amount")), field(".claim.value"));
  }

  function testRetireContent() public view {
    assertEq(YacanaHashes.retireContent(vm.parseJsonUint(json, ".retire.version")), field(".retire.value"));
  }

  function testRetireSecretHash() public view {
    assertEq(YacanaHashes.RETIRE_SECRET_HASH, field(".retireSecretHash"));
  }
}
