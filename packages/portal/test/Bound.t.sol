// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

import {YacanaPortal} from "../src/YacanaPortal.sol";
import {FakeRollup, Harness} from "./Harness.sol";

/// The cap, the pauses and the deadline: what bounds a version's issuance and how honest exits
/// wait rather than lose.
contract BoundTest is Harness {
  function testTheCapStartsAtTheAllowanceAndGrowsPerHour() public {
    assertEq(portal.cap(V1), ALLOWANCE);
    vm.warp(block.timestamp + 10 hours);
    assertEq(portal.cap(V1), ALLOWANCE + 10 * PER_HOUR);
  }

  function testTheCapSaturatesBeforeTheLaunch() public {
    registerV2At(flipTo(V2), uint64(block.timestamp + 30 days));
    assertEq(portal.cap(V2), ALLOWANCE);
    vm.warp(block.timestamp + 31 days);
    assertEq(portal.cap(V2), ALLOWANCE + 24 * PER_HOUR);
  }

  function testAnExitOverTheCapWaitsAndStaysConsumable() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, ALLOWANCE + 1, 3);
    vm.expectRevert(
      abi.encodeWithSelector(YacanaPortal.WaitsForHeadroom.selector, V1, ALLOWANCE + 1, ALLOWANCE)
    );
    portal.forward(V1, a);
    vm.warp(block.timestamp + 1 hours);
    portal.forward(V1, a);
    assertEq(portal.YACA_TOKEN().balanceOf(alice), ALLOWANCE + 1);
  }

  function testInboundCreditsTheCap() public {
    // A version that received before it ever exited: everything that came in may leave again.
    FakeRollup v2 = flipTo(V2);
    registerV2(v2);
    YacanaPortal.ForwardArgs memory a = publishedAhead(v1, MINER, ALLOWANCE, 3);
    vm.prank(forwarder);
    portal.forward(V1, a);
    assertEq(portal.headroom(V2), ALLOWANCE + ALLOWANCE);
    YacanaPortal.ForwardArgs memory out = publishedExit(v2, MINER2, ALLOWANCE + ALLOWANCE, 1);
    portal.forward(V2, out);
    assertEq(portal.headroom(V2), 0);
  }

  function testTheCapFreezesAtTheObservedFlip() public {
    vm.warp(block.timestamp + 10 hours);
    flipTo(V2);
    portal.noteTransition(1);
    uint256 frozen = portal.cap(V1);
    assertEq(frozen, ALLOWANCE + 10 * PER_HOUR);
    vm.warp(block.timestamp + 100 days);
    assertEq(portal.cap(V1), frozen);
  }

  function testAnUnobservedFlipKeepsGrowingUntilSomeoneCalls() public {
    vm.warp(block.timestamp + 10 hours);
    flipTo(V2);
    vm.warp(block.timestamp + 5 hours);
    // Nobody called: the cap grew for the five hours too.
    assertEq(portal.cap(V1), ALLOWANCE + 15 * PER_HOUR);
    portal.noteTransition(1);
    vm.warp(block.timestamp + 5 hours);
    assertEq(portal.cap(V1), ALLOWANCE + 15 * PER_HOUR);
  }

  function testAnObservedTransitionIsNeverRewritten() public {
    flipTo(V2);
    portal.noteTransition(1);
    uint64 first = portal.flipAt(V1);
    vm.warp(block.timestamp + 1 days);
    portal.noteTransition(1);
    assertEq(portal.flipAt(V1), first);
  }

  function testARevertingCallLeavesNoRecord() public {
    flipTo(V2);
    // retire() reverts on the unregistered V2 after _sync recorded the flip: the record rolls back.
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.NotRegistered.selector, V2));
    portal.retire(V2);
    assertEq(portal.transitions(1), 0);
    portal.noteTransition(1);
    assertGt(portal.transitions(1), 0);
  }

  function testTheDeadlineIsOpenUntilAFlipIsRecorded() public {
    assertEq(portal.deadline(V1), type(uint256).max);
  }

  function testTheDeadlineIsTheFloorWhenTheVersionAfterNextIsEarlier() public {
    flipTo(V2);
    portal.noteTransition(1);
    uint64 flip = portal.flipAt(V1);
    vm.warp(block.timestamp + 10 days);
    flipTo(V3);
    portal.noteTransition(2);
    assertEq(portal.deadline(V1), uint256(flip) + EXIT_FLOOR);
  }

  function testTheDeadlineFollowsTheVersionAfterNextWhenItIsLater() public {
    flipTo(V2);
    portal.noteTransition(1);
    vm.warp(block.timestamp + 200 days);
    flipTo(V3);
    portal.noteTransition(2);
    assertEq(portal.deadline(V1), portal.afterNextAt(V1));
  }

  function testExitsClosePastTheDeadline() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 1 ether, 3);
    flipTo(V2);
    portal.noteTransition(1);
    vm.warp(portal.deadline(V1) + 1);
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.DeadlinePassed.selector, V1));
    portal.forward(V1, a);
  }

  function testAPauseHoldsExitsAndExtendsTheDeadline() public {
    YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, 1 ether, 3);
    flipTo(V2);
    portal.noteTransition(1);
    uint256 before = portal.deadline(V1);
    vm.prank(operators);
    portal.pause(V1, 10 days);
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.VersionPaused.selector, V1));
    portal.forward(V1, a);
    assertEq(portal.deadline(V1), before + 10 days);
    vm.warp(block.timestamp + 10 days + 1);
    portal.forward(V1, a);
  }

  function testAPauseIsBoundedPerCallAndInTotal() public {
    vm.startPrank(operators);
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.PauseTooLong.selector, uint64(31 days)));
    portal.pause(V1, 31 days);
    portal.pause(V1, 30 days);
    portal.pause(V1, 30 days);
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.PauseBudgetExhausted.selector, V1));
    portal.pause(V1, 1);
    vm.stopPrank();
    assertEq(portal.versionInfo(V1).pausedUntil, block.timestamp + 60 days);
  }

  function testUnpauseRefundsTheUnusedRemainder() public {
    vm.startPrank(operators);
    portal.pause(V1, 30 days);
    vm.warp(block.timestamp + 10 days);
    portal.unpause(V1);
    vm.stopPrank();
    assertEq(portal.versionInfo(V1).pausedSeconds, 10 days);
    assertFalse(portal.isPaused(V1));
  }

  function testAnExpiredPauseRefundsNothing() public {
    vm.startPrank(operators);
    portal.pause(V1, 1 days);
    vm.warp(block.timestamp + 2 days);
    portal.unpause(V1);
    vm.stopPrank();
    assertEq(portal.versionInfo(V1).pausedSeconds, 1 days);
  }

  function testPauseAllSkipsAnExhaustedVersion() public {
    registerV2(flipTo(V2));
    vm.startPrank(operators);
    portal.pause(V1, 30 days);
    portal.pause(V1, 30 days);
    portal.pauseAll(1 days);
    vm.stopPrank();
    assertEq(portal.versionInfo(V1).pausedSeconds, 60 days);
    assertEq(portal.versionInfo(V2).pausedSeconds, 1 days);
  }

  function testADormantVersionAccruesItsOwnPausesOnly() public {
    registerV2(flipTo(V2));
    vm.prank(operators);
    portal.pause(V1, 5 days);
    assertEq(portal.versionInfo(V2).pausedSeconds, 0);
    assertFalse(portal.isPaused(V2));
  }

  function testOnlyTheOperatorsPause() public {
    vm.prank(alice);
    vm.expectRevert(abi.encodeWithSelector(YacanaPortal.NotOperators.selector, alice));
    portal.pause(V1, 1 days);
  }

  /// Fuzz: whatever the schedule of exits and inbound, a version never issues past its cap plus
  /// what came in.
  function testFuzzNetIssuanceStaysUnderTheCap(uint64[6] memory amounts, uint8 hours_) public {
    vm.warp(block.timestamp + uint256(hours_) * 1 hours);
    uint256 issued = 0;
    for (uint64 i = 0; i < 6; i++) {
      uint256 amount = uint256(amounts[i]) % (ALLOWANCE / 2) + 1;
      YacanaPortal.ForwardArgs memory a = publishedExit(v1, MINER, amount, 10 + i);
      if (amount <= portal.headroom(V1)) {
        portal.forward(V1, a);
        issued += amount;
      } else {
        vm.expectRevert();
        portal.forward(V1, a);
      }
    }
    assertEq(portal.versionInfo(V1).exited, issued);
    assertLe(issued, portal.cap(V1));
  }
}
