// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

import {ERC20} from "@oz/token/ERC20/ERC20.sol";

/// Yacana on Ethereum. Every unit is a unit that left an Aztec version through the portal, and the
/// portal is the only address that ever mints or burns: set once here, never changed.
contract YACA is ERC20 {
  address public immutable PORTAL;

  error NotPortal(address caller);

  constructor(string memory name_, string memory symbol_, address portal) ERC20(name_, symbol_) {
    PORTAL = portal;
  }

  function mint(address to, uint256 amount) external {
    require(msg.sender == PORTAL, NotPortal(msg.sender));
    _mint(to, amount);
  }

  function burnFrom(address from, uint256 amount) external {
    require(msg.sender == PORTAL, NotPortal(msg.sender));
    _burn(from, amount);
  }
}
