// SPDX-License-Identifier: Apache-2.0
pragma solidity >=0.8.27;

import {IInbox} from "@aztec/IInbox.sol";
import {IERC20} from "@oz/token/ERC20/IERC20.sol";

// The real Inbox deploys a FeeJuicePortal in its constructor; under test nothing bridges fee
// juice, so the vendored Inbox deploys this shape-only stand-in instead.
contract FeeJuicePortalStub {
  address public immutable ROLLUP;
  IInbox public immutable INBOX;
  IERC20 public immutable UNDERLYING;
  uint256 public immutable VERSION;

  constructor(address _rollup, IERC20 _underlying, IInbox _inbox, uint256 _version) {
    ROLLUP = _rollup;
    UNDERLYING = _underlying;
    INBOX = _inbox;
    VERSION = _version;
  }
}
