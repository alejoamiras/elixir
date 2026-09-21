// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.30;

import {Hash} from "@aztec/Hash.sol";

/// The message contents the portal and the miner agree on: the first four bytes of keccak256 of
/// the ABI-style signature, then each argument as a 32-byte word, then sha256 truncated into a
/// field — what `abi.encodeWithSignature` produces, hashed as `Hash.sha256ToField` does. The Noir
/// crate `yacana_bridge_hashes` and `packages/bridge` compute the same bytes; the shared vectors pin
/// all three.
library YacanaHashes {
  /// `compute_secret_hash([0])` on Aztec: the retire message's secret is the fixed zero, so anyone
  /// may consume it — the message's existence is the authority. Pinned by the vectors, never
  /// computed here (Poseidon2 has no cheap L1 form).
  bytes32 internal constant RETIRE_SECRET_HASH =
    0x1f8eff65d91ed781c2e7a28a2ff99b7f7506b7293121b5ffcf3cd339c84d2250;

  function exitContent(address recipient, uint256 amount, bytes32 tag) internal pure returns (bytes32) {
    return Hash.sha256ToField(abi.encodeWithSignature("exit_to_l1(address,uint256,bytes32)", recipient, amount, tag));
  }

  function sendAheadContent(uint256 amount, bytes32 secretHash, address redeemKey) internal pure returns (bytes32) {
    return Hash.sha256ToField(
      abi.encodeWithSignature("send_ahead(uint256,bytes32,address)", amount, secretHash, redeemKey)
    );
  }

  function claimContent(uint256 amount) internal pure returns (bytes32) {
    return Hash.sha256ToField(abi.encodeWithSignature("claim_from_l1(uint256)", amount));
  }

  function retireContent(uint256 version) internal pure returns (bytes32) {
    return Hash.sha256ToField(abi.encodeWithSignature("retire(uint256)", version));
  }
}
