// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

import {Test} from "forge-std/Test.sol";
import {DataStructures} from "@aztec/DataStructures.sol";
import {Hash} from "@aztec/Hash.sol";
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

  function testEdgeContents() public view {
    address recipient = vm.parseJsonAddress(json, ".edge.recipient");
    uint256 amount = vm.parseJsonUint(json, ".edge.amount");
    bytes32 tag = field(".edge.tag");
    assertEq(YacanaHashes.exitContent(recipient, amount, tag), field(".edge.exitValue"));
    assertEq(YacanaHashes.sendAheadContent(amount, tag, recipient), field(".edge.sendAheadValue"));
    assertEq(YacanaHashes.claimContent(amount), field(".edge.claimValue"));
  }

  function testRetireSecretHash() public view {
    assertEq(YacanaHashes.RETIRE_SECRET_HASH, field(".retireSecretHash"));
  }

  /// The miner's exit as the rollup's Outbox hashes it: what packages/bridge computes off-chain.
  function testOutboxLeaf() public view {
    DataStructures.L2ToL1Msg memory m = DataStructures.L2ToL1Msg({
      sender: DataStructures.L2Actor(field(".messages.miner"), vm.parseJsonUint(json, ".retire.version")),
      recipient: DataStructures.L1Actor(
        vm.parseJsonAddress(json, ".crossing.scope.portal"), vm.parseJsonUint(json, ".crossing.scope.chainId")
      ),
      content: field(".exit.value")
    });
    assertEq(Hash.sha256ToField(m), field(".messages.outboxLeaf"));
  }

  /// A claim's message as the Inbox inserts it: what the L2 claim names to consume it.
  function testInboxLeaf() public view {
    DataStructures.L1ToL2Msg memory m = DataStructures.L1ToL2Msg({
      sender: DataStructures.L1Actor(
        vm.parseJsonAddress(json, ".crossing.scope.portal"), vm.parseJsonUint(json, ".crossing.scope.chainId")
      ),
      recipient: DataStructures.L2Actor(field(".messages.miner"), vm.parseJsonUint(json, ".retire.version")),
      content: field(".claim.value"),
      secretHash: field(".sendAhead.secretHash"),
      index: vm.parseJsonUint(json, ".messages.inboxIndex")
    });
    assertEq(Hash.sha256ToField(m), field(".messages.inboxLeaf"));
  }

  /// The EIP-712 digests the portal recovers a signer from, as the browser's signer computes them.
  function testSignedDigests() public view {
    bytes32 ds = keccak256(
      abi.encode(
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
        keccak256("YacanaPortal"),
        keccak256("1"),
        vm.parseJsonUint(json, ".crossing.scope.chainId"),
        vm.parseJsonAddress(json, ".crossing.scope.portal")
      )
    );
    uint256 version = vm.parseJsonUint(json, ".retire.version");
    uint256 epoch = vm.parseJsonUint(json, ".signed.epoch");
    uint256 leafId = vm.parseJsonUint(json, ".signed.leafId");
    uint256 expiry = vm.parseJsonUint(json, ".signed.expiry");
    bytes32 content = field(".sendAhead.value");
    bytes32 forwardStruct = keccak256(
      abi.encode(
        keccak256(
          "Forward(uint256 version,uint256 epoch,uint256 leafId,bytes32 contentHash,uint256 target,uint256 expiry)"
        ),
        version,
        epoch,
        leafId,
        content,
        vm.parseJsonUint(json, ".signed.target"),
        expiry
      )
    );
    assertEq(keccak256(abi.encodePacked("\x19\x01", ds, forwardStruct)), field(".signed.forwardDigest"));
    bytes32 redeemStruct = keccak256(
      abi.encode(
        keccak256(
          "Redeem(uint256 version,uint256 epoch,uint256 leafId,bytes32 contentHash,address recipient,uint256 expiry)"
        ),
        version,
        epoch,
        leafId,
        content,
        vm.parseJsonAddress(json, ".signed.recipient"),
        expiry
      )
    );
    assertEq(keccak256(abi.encodePacked("\x19\x01", ds, redeemStruct)), field(".signed.redeemDigest"));
  }
}
