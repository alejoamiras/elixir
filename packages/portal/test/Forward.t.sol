// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

import {Errors} from "@aztec/Errors.sol";
import {Epoch} from "@aztec/TimeLib.sol";
import {YacanaPortal} from "../src/YacanaPortal.sol";
import {FakeRollup, Harness} from "./Harness.sol";

/// Consuming exits against the real Outbox: to Ethereum, sent ahead, and every way it must refuse.
contract ForwardTest is Harness {
  function testExitToEthereumMintsToTheRecipient() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 5 ether, 3);
    vm.prank(alice);
    portal.forward(V1, a);
    assertEq(portal.YACA_TOKEN().balanceOf(alice), 5 ether);
    assertEq(portal.versionInfo(V1).exited, 5 ether);
  }

  function testTheSameLeafCannotBeConsumedTwice() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 5 ether, 3);
    portal.forward(V1, a);
    vm.expectRevert(abi.encodeWithSelector(Errors.Outbox__AlreadyNullified.selector, Epoch.wrap(3), 2));
    portal.forward(V1, a);
  }

  function testAWrongAmountIsNotInTheTree() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 5 ether, 3);
    a.amount = 6 ether;
    vm.expectRevert();
    portal.forward(V1, a);
  }

  function testALeafFromAnotherMinerIsNotInTheTree() public {
    // Published by the registered miner, claimed as if from another: the message hash differs.
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER2, 5 ether, 3);
    vm.expectRevert();
    portal.forward(V1, a);
  }

  function testAnEpochWithoutARootHasNothingToConsume() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 5 ether, 3);
    a.epoch = Epoch.wrap(4);
    vm.expectRevert(abi.encodeWithSelector(Errors.Outbox__NothingToConsumeAtEpoch.selector, Epoch.wrap(4)));
    portal.forward(V1, a);
  }

  function testTheSameLeafIdInAnotherEpochIsAnotherMessage() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 5 ether, 3);
    YacanaPortal.ForwardArgs memory b = publishedExit(v1, MINER, 5 ether, 4);
    portal.forward(V1, a);
    portal.forward(V1, b);
    assertEq(portal.YACA_TOKEN().balanceOf(alice), 10 ether);
  }

  function testAnUnregisteredVersionCannotForward() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 5 ether, 3);
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.NotRegistered.selector, V2));
    portal.forward(V2, a);
  }

  function testASendAheadWaitsForARegisteredLaterVersion() public {
    YacanaPortal.ForwardArgs memory a = publishedAhead(v1, MINER, 5 ether, 3);
    vm.prank(forwarder);
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.NotForwardable.selector, V1, V1));
    portal.forward(V1, a);
  }

  function testAForwarderSendsAheadIntoTheLiveVersion() public {
    YacanaPortal.ForwardArgs memory a = publishedAhead(v1, MINER, 5 ether, 3);
    FakeRollup v2 = flipTo(V2);
    registerV2(v2);
    vm.prank(forwarder);
    portal.forward(V1, a);
    assertEq(portal.versionInfo(V1).exited, 5 ether);
    assertEq(portal.versionInfo(V2).inbound, 5 ether);
    assertEq(v2.INBOX().getTotalMessagesInserted(), 1);
    assertEq(portal.YACA_TOKEN().totalSupply(), 0);
  }

  function testTheHolderSendsAheadWithTheRedeemKeysSignature() public {
    YacanaPortal.ForwardArgs memory a = publishedAhead(v1, MINER, 5 ether, 3);
    FakeRollup v2 = flipTo(V2);
    registerV2(v2);
    a.expiry = uint64(block.timestamp + 1 hours);
    a.sig = signForward(redeemKey, V1, a, V2, a.expiry);
    vm.prank(alice);
    portal.forward(V1, a);
    assertEq(portal.versionInfo(V2).inbound, 5 ether);
  }

  function testAStrangerCannotSendAheadWithoutASignature() public {
    YacanaPortal.ForwardArgs memory a = publishedAhead(v1, MINER, 5 ether, 3);
    registerV2(flipTo(V2));
    vm.prank(alice);
    vm.expectRevert();
    portal.forward(V1, a);
  }

  function testAnExpiredSignatureIsRefused() public {
    YacanaPortal.ForwardArgs memory a = publishedAhead(v1, MINER, 5 ether, 3);
    registerV2(flipTo(V2));
    a.expiry = uint64(block.timestamp - 1);
    a.sig = signForward(redeemKey, V1, a, V2, a.expiry);
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.SignatureExpired.selector, a.expiry));
    portal.forward(V1, a);
  }

  function testARedeemSignatureDoesNotForward() public {
    YacanaPortal.ForwardArgs memory a = publishedAhead(v1, MINER, 5 ether, 3);
    registerV2(flipTo(V2));
    a.expiry = uint64(block.timestamp + 1 hours);
    a.sig = signRedeem(redeemKey, V1, a, alice, a.expiry);
    vm.expectRevert();
    portal.forward(V1, a);
  }

  function testASignatureForAnotherTargetDoesNotForward() public {
    YacanaPortal.ForwardArgs memory a = publishedAhead(v1, MINER, 5 ether, 3);
    registerV2(flipTo(V2));
    a.expiry = uint64(block.timestamp + 1 hours);
    a.sig = signForward(redeemKey, V1, a, V3, a.expiry);
    vm.expectRevert();
    portal.forward(V1, a);
  }

  function testABatchContinuesPastAFailedLeaf() public {
    YacanaPortal.ForwardArgs[] memory batch = new YacanaPortal.ForwardArgs[](3);
    batch[0] = publishedExit(v1, MINER, 1 ether, 3);
    batch[1] = publishedExit(v1, MINER, 2 ether, 4);
    batch[1].amount = 9 ether; // not in the tree
    batch[2] = publishedExit(v1, MINER, 3 ether, 5);
    portal.forwardMany(V1, batch);
    assertEq(portal.YACA_TOKEN().balanceOf(alice), 4 ether);
  }

  function testAMalformedLeafCannotRevertEarlierBatchSuccess() public {
    YacanaPortal.ForwardArgs[] memory batch = new YacanaPortal.ForwardArgs[](2);
    batch[0] = publishedExit(v1, MINER, 1 ether, 3);
    batch[1] = publishedExit(v1, MINER, 2 ether, 4);
    batch[1].leafIndex = type(uint256).max;
    portal.forwardMany(V1, batch);
    assertEq(portal.YACA_TOKEN().balanceOf(alice), 1 ether);
  }

  function testAFailedLeafRollsBackButTheOuterSyncSurvives() public {
    YacanaPortal.ForwardArgs[] memory batch = new YacanaPortal.ForwardArgs[](1);
    batch[0] = publishedExit(v1, MINER, ALLOWANCE + 1, 3); // over the cap: the leaf reverts
    flipTo(V2);
    assertEq(portal.transitions(1), 0);
    portal.forwardMany(V1, batch);
    assertGt(portal.transitions(1), 0);
    assertEq(portal.versionInfo(V1).exited, 0);
    assertFalse(v1.OUTBOX().hasMessageBeenConsumedAtEpoch(Epoch.wrap(3), 2));
  }

  function testForwardOneIsSelfOnly() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 1 ether, 3);
    vm.expectRevert(YacanaPortal.NotSelf.selector);
    portal.forwardOne(alice, V1, a);
  }

  function testABatchCarriesTheForwardersAuthority() public {
    YacanaPortal.ForwardArgs[] memory batch = new YacanaPortal.ForwardArgs[](1);
    batch[0] = publishedAhead(v1, MINER, 5 ether, 3);
    registerV2(flipTo(V2));
    vm.prank(forwarder);
    portal.forwardMany(V1, batch);
    assertEq(portal.versionInfo(V2).inbound, 5 ether);
  }

  function testABatchDoesNotLendTheForwardersAuthorityToAStranger() public {
    YacanaPortal.ForwardArgs[] memory batch = new YacanaPortal.ForwardArgs[](1);
    batch[0] = publishedAhead(v1, MINER, 5 ether, 3);
    registerV2(flipTo(V2));
    vm.prank(alice);
    portal.forwardMany(V1, batch);
    assertEq(portal.versionInfo(V2).inbound, 0);
  }
}
