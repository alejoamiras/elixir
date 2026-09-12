# research — cross-chain reference flows (Aztec 5.2.0)

Persisted from a read-only research agent (2026-09-12). `R` = the pinned sources at
`~/nargo/github.com/AztecProtocol/aztec-packages/v5.2.0`. Line numbers are of that checkout. The agent had no
grep; every claim is from a file read in full, and the "unknown" list at the end says what it could not locate.

## 1. The L2 token bridge (Noir) — the template for the miner's bridge functions

- `R/noir-projects/noir-contracts/contracts/app/token_bridge_contract/src/main.nr` (138 lines): storage is one
  `PublicImmutable<Config>` (`:25-28`), `Config { token: AztecAddress, portal: EthAddress }` (`config.nr:6-10`),
  set in the `#[initializer]` constructor (`:31-35`) — the portal address is fixed at deploy and read in private and
  public.
- `claim_public(to, amount: u128, secret: Field, message_leaf_index: Field)` (`:51-62`): content =
  `get_mint_to_public_content_hash(to, amount)`; `self.context.consume_l1_to_l2_message(content, [secret],
  config.portal, message_leaf_index)`; then `Token::mint_to_public`.
- `claim_private(recipient, amount: u128, secret, message_leaf_index)` (`:91-111`): content =
  `get_mint_to_private_content_hash(amount)` — the recipient is NOT in the content (`:88-90` warns the amount is the
  only privacy set).
- `exit_to_l1_private(token, recipient: EthAddress, amount: u128, caller_on_l1: EthAddress, authwit_nonce: Field)`
  (`:116-137`): `self.context.message_portal(config.portal, content)` then
  `Token::at(token).burn_private(self.msg_sender(), amount, authwit_nonce)`.
- Content hashes: `R/noir-projects/noir-contracts/contracts/libs/token_portal_content_hash_lib/src/lib.nr` —
  4-byte keccak selector of a signature string ‖ 32-byte args, then `sha256_to_field` (`:5-81`).
- Hash helpers `R/noir-projects/aztec-nr/aztec/src/hash.nr`: `compute_secret_hash(secret: [Field; N]) =
  poseidon2_hash_with_separator(secret, DOM_SEP__SECRET_HASH)` (`:15-17`); `compute_l1_to_l2_message_hash(sender,
  chain_id, recipient, version, content, secret_hash, leaf_index)` over 224 bytes, 7 BE words in that order
  (`:19-48`); nullifier `poseidon2([message_hash] ++ secret, DOM_SEP__MESSAGE_NULLIFIER)` (`:51-53`). Noir↔TS
  vectors as `#[test]`s at `:96-134` (`compute_secret_hash([8]) == 0x1848b0…1e96`).
- Private context (`R/noir-projects/aztec-nr/aztec/src/context/private_context.nr`): `message_portal(&mut self,
  recipient: EthAddress, content: Field)` (`:861-864`); `consume_l1_to_l2_message<let N>(&mut self, content, secret:
  [Field; N], sender: EthAddress, leaf_index: Field)` (`:890-910`); `MAX_L2_TO_L1_MSGS_PER_CALL` bound (`:162`).
  `messaging.nr:18-43`: the root is the anchor block header's `l1_to_l2_message_tree`, so the message must be in
  the tree at the block the PXE anchors to.
- Public context (`public_context.nr`): `l1_to_l2_msg_exists(msg_hash, leaf_index)` (`:156-161`);
  `consume_l1_to_l2_message` (`:239-263`) asserts "L1-to-L2 message is already nullified" then "Tried to consume
  nonexistent L1-to-L2 message"; `message_portal` (`:265+`).
- The token's burn: `#[authorize_once("from", "authwit_nonce")] #[external("private")] fn burn_private(from,
  amount: u128, authwit_nonce: Field)` (`token_contract/src/main.nr:302-307`; aztec-standards is the same shape).
  `authorize_once` (`aztec/src/macros/functions/mod.nr:289-326`): `from` may call with nonce 0; any other caller
  needs an authwit for that nonce, single use, all other params bound.
- Authwit lib `R/noir-projects/aztec-nr/aztec/src/authwit/auth.nr` (423 lines): inner hash = poseidon2 over
  `[msg_sender, selector, args_hash]` (`:359-361`), outer = `[consumer, chain_id, version, inner]` (`:381-391`),
  nullifier `compute_authwit_nullifier(on_behalf_of, inner)` (`:369-374`).

## 2. The Solidity portals (L1)

- `R/l1-contracts/test/portals/TokenPortal.sol` (152 lines): state `registry, underlying, l2Bridge, rollup, outbox,
  inbox, rollupVersion` (`:22-29`); `initialize` caches the canonical rollup's boxes and version (`:37-46`) and has
  NO access control or re-init guard (a production portal takes immutables, cf. `FeeJuicePortal.sol:25-30`).
  `depositToAztecPrivate(amount, secretHash)` → `abi.encodeWithSignature("mint_to_private(uint256)", amount)`,
  `inbox.sendL2Message(L2Actor(l2Bridge, rollupVersion), contentHash, secretHash)`, emits
  `DepositToAztecPrivate(amount, secretHash, key, index)` (`:89-110`). `withdraw(recipient, amount, withCaller,
  epoch, numCheckpointsInEpoch, leafIndex, path)` rebuilds `L2ToL1Msg{sender: L2Actor(l2Bridge, rollupVersion),
  recipient: L1Actor(this, chainid), content}` and calls `outbox.consume` (`:126-150`).
- `R/l1-contracts/src/core/libraries/crypto/Hash.sol`: `sha256ToField(L1ToL2Msg) = sha256ToField(abi.encode(sender,
  recipient, content, secretHash, index))` (`:19-23`); `sha256ToField(L2ToL1Msg) = …(abi.encodePacked(sender.actor,
  sender.version, recipient.actor, recipient.chainId, content))` (`:30-40`); `sha256ToField(bytes)` PREPENDS a zero
  byte to `bytes31(sha256(data))` (`:49-51`) — never truncate with `bytes31(bytes32)`.
- `R/l1-contracts/test/portals/UniswapPortal.sol`: the precedent for "consume an Outbox message and send an Inbox
  message in one tx" (`:64-153`, `:170-256`); uses `OutboxMessageMetadata { Epoch _epoch; uint256
  _numCheckpointsInEpoch; uint256 _leafIndex; bytes32[] _path; }` (`test/portals/DataStructures.sol:8-13`) to dodge
  stack-too-deep; the user's `_secretHashForL1ToL2Message` is bound into the consumed content (`:176, :211`).
- `R/l1-contracts/test/portals/TokenPortal.t.sol`: Foundry vectors — expected L1→L2 message and the first real
  index `(FIRST_REAL_TREE_NUM − 1) × 2^10` with `FIRST_REAL_TREE_NUM = INITIAL_CHECKPOINT_NUMBER + AZTEC_INBOX_LAG`
  (`:37-38, :122, :149`); rolling hash (`:126`); `leafId = 2 ** siblingPath.length + leafIndex` (`:223, :265`);
  replay → `Outbox__AlreadyNullified` (`:234`); wrong designated caller → `MerkleLib__InvalidRoot` (`:246-255`).

## 3. Inbox / Outbox / DataStructures (exact)

- `DataStructures.sol`: `L1Actor { address actor; uint256 chainId }` (`:17-20`), `L2Actor { bytes32 actor; uint256
  version }` (`:30-33`), `L1ToL2Msg { sender, recipient, content, secretHash, index }` (`:47-53`), `L2ToL1Msg
  { sender: L2Actor, recipient: L1Actor, content }` (`:65-69`).
- `Inbox.sol` (180 lines): immutables `ROLLUP, VERSION, FEE_ASSET_PORTAL, LAG, HEIGHT, SIZE` (`:26-34`), `LAG > 0`
  (`:48-51`); `sendL2Message(L2Actor recipient, bytes32 content, bytes32 secretHash) returns (leaf, index)`
  (`:75-128`): actor/content/secretHash ≤ `MAX_FIELD_VALUE`, `recipient.version == VERSION`
  (`Inbox__VersionMismatch`), global `index = (inProgress − INITIAL_CHECKPOINT_NUMBER) × SIZE + nextIndex`
  (`:99-102`), sender = `msg.sender` except the fee-asset portal rewrite (`:104-107`), emits `MessageSent(inProgress,
  index, leaf, rollingHash)` (`:125`). No fee, no payable, no allowlist. `consume` is rollup-only and advances
  `inProgress` when `toConsume + LAG == inProgress` (`:141-159`).
- `Outbox.sol` (214 lines): `EpochData { bytes32[32] roots; BitMap nullified }` (`:56-68`); `insert(epoch,
  numCheckpointsInEpoch, root)` rollup-only (`:103-113`); `consume(L2ToL1Msg, epoch, numCheckpointsInEpoch,
  leafIndex, path)` (`:130-170`) checks in order: path < 256, leafIndex < 2^len, `sender.version == VERSION`,
  `msg.sender == recipient.actor`, `chainid`, num ∈ [1,32], `roots[num−1] != 0`, `leafId = (1 << len) + leafIndex`
  not nullified, Merkle membership; emits `MessageConsumed(epoch, root, messageHash, leafId, num)`.
  `hasMessageBeenConsumedAtEpoch(epoch, leafId)` (`:182-184`), `getRoots(epoch)` (`:211-213`).
- Errors `Errors.sol:25-51`. Constants: `L1_TO_L2_MSG_SUBTREE_HEIGHT = 10`, `MAX_L2_TO_L1_MSGS_PER_TX = 8`,
  `INITIAL_CHECKPOINT_NUMBER = 1`, `MAX_CHECKPOINTS_PER_EPOCH = 32` (`ConstantsGen.sol:18-21`); TS
  `constants.gen.ts`: `MAX_L2_TO_L1_MSGS_PER_CALL = 8` (`:51`), `DomainSeparator.SECRET_HASH = 4199652938` (`:575`),
  `MESSAGE_NULLIFIER = 3754509616` (`:524`). Test deployment: `AZTEC_SLOT_DURATION = 72`, `AZTEC_EPOCH_DURATION = 32`,
  `AZTEC_INBOX_LAG = 2`, `AZTEC_PROOF_SUBMISSION_EPOCHS = 1` (`test/harnesses/TestConstants.sol:23-29`); the version
  is `uint32(keccak256(abi.encode("aztec_rollup", chainid, genesisState, config)))` (`:139-141`).
- `Registry.sol`: `getRollup(version)` reverts `Registry__RollupNotRegistered` (`:84-88`); `IRegistry.getRollup`
  returns `IHaveVersion` (only `getVersion()`), cast to `IRollup` for `getInbox()/getOutbox()` as `TokenPortal
  .initialize` does (`:42-45`).

## 4. The TypeScript side (5.2.0)

- `R/yarn-project/end-to-end/src/shared/cross_chain_test_harness.ts`: deploys the portal with
  `deployL1Contract(l1Client, TokenPortalAbi, TokenPortalBytecode)` (`:72`), the bridge, `set_minter` (`:100`),
  `initialize` (`:106-109`); `withdrawPrivateFromAztecToL1(amount, authwitNonce, authWitness)` sends
  `exit_to_l1_private(...).send({ authWitnesses: [authWitness], from })` (`:283-293`);
  `makeMessageConsumable(msgHash)` = `waitForL1ToL2MessageSeen` + two no-op L2 txs (`:360-373`).
- `@aztec/aztec.js/messaging` (`aztec.js/src/utils/cross_chain.ts`): `isL1ToL2MessageReady(node, hash, chainTip)`
  = `node.getL1ToL2MessageCheckpoint(hash)` ≤ `node.getBlockData(tip).checkpointNumber` (`:41-54`);
  `waitForL1ToL2MessageReady(node, hash, {timeoutSeconds, chainTip})` (`:12-31`); pass `'proven'` when the PXE
  syncs to the proven tip.
- `@aztec/aztec.js/ethereum` (`aztec.js/src/ethereum/portal_manager.ts`): `generateClaimSecret() → [Fr, Fr]`
  (`:53-58`); the Inbox insert gas swings ~40k so the client buffers gas 100 % (`:60-73`);
  `L1ToL2TokenPortalManager.bridgeTokensPrivate` simulates, sends, extracts `DepositToAztecPrivate` → `{messageHash:
  key, messageLeafIndex: index}` (`:367-419`); `L1TokenPortalManager.withdrawFunds` checks
  `hasMessageBeenConsumedAtEpoch` before and after, builds `[recipient, amount, false, epoch, num, leafIndex,
  path.toBufferArray()…]` (`:463-507`); `getL2ToL1MessageLeaf` recomputes the leaf with
  `computeL2ToL1MessageHash({l2Sender, l1Recipient, content, rollupVersion, chainId})` (`:516-538`).
- `@aztec/stdlib/hash` (`stdlib/src/hash/hash.ts`): `computeSecretHash(secret) = poseidon2HashWithSeparator([secret],
  SECRET_HASH)` (`:187-189`); `computeL2ToL1MessageHash` hashes `[l2Sender, rollupVersion, l1Recipient, chainId,
  content]` — the ORDER differs from the object keys (`:195-209`). Vectors in `hash.test.ts:140-213`.
- `@aztec/stdlib/messaging`: `L1ToL2Message.hash() = sha256ToField(toFields())` (`l1_to_l2_message.ts:38-48`);
  `getL1ToL2MessageWitness(node, messageHash, unsiloedNullifier?, referenceBlock)` → `node
  .getL1ToL2MessageMembershipWitness(referenceBlock, messageHash)` (`:102-127`);
  `getL2ToL1MessageLeafId({leafIndex, siblingPath}) = 2n ** pathSize + leafIndex` (`l2_to_l1_membership.ts:110-114`);
  `L2ToL1MembershipWitness = { epochNumber, numCheckpointsInEpoch, root, leafIndex, siblingPath }` (`:116-127`); the
  combined path is message‖tx‖block‖checkpoint, variable length (`:310-314`); the local root is cross-checked against
  the Outbox and throws on mismatch (`:220-229`).
- Node RPC (`stdlib/src/interfaces/aztec-node.ts`): `getL1ToL2MessageMembershipWitness(referenceBlock, msg): [bigint,
  SiblingPath<36>] | undefined` (`:203-206`); `getL1ToL2MessageCheckpoint(msg)` (`:208-209`);
  `getL2ToL1MembershipWitness(txHash, message, messageIndexInTx?)` (`:239-243`, `getL2ToL1Messages` deprecated
  `:214`); `getTxReceipt(txHash)` → `epochNumber, blockNumber` (`:432-435`); `getBlockNumber('proven')` (`:249`).
- `waitForProven(node, receipt, { provenTimeout })` polls `getBlockNumber('proven')` (`aztec.js/src/contract/
  wait_for_proven.ts:25-38`, exported from `@aztec/aztec.js/contracts`).
- `@aztec/ethereum/contracts` `OutboxContract`: `getRoots(epoch)`, `hasMessageBeenConsumedAtEpoch`, `consume(message,
  epoch, num, leafIndex, path)`, `getMessageConsumedEvents` (`ethereum/src/contracts/outbox.ts:80-124`).
- The end-to-end recipe (`end-to-end/src/shared/uniswap_l1_l2.ts`): authwit for a contract-initiated private call
  `wallet.createAuthWit(owner, { caller: contract.address, action: token.methods.transfer_to_public(...) })`
  (`:183-191`), sent with `.send({ from, authWitnesses: [w] })` (`:209`); after the exit tx:
  `cheatCodes.rollup.advanceToEpoch(EpochNumber(receipt.epochNumber + 1))` then `waitForProven(node, receipt,
  { provenTimeout: 300 })` (`:251-258`) — "the outbox is only consumable when the epoch is proven"; the witness with
  `retryUntil(() => node.getL2ToL1MembershipWitness(txHash, leaf), '…', 60, 1)` (`:265-277`);
  `numCheckpointsInEpoch` is per witness (`:285-301`); the new Inbox message read back from the receipt's
  `MessageSent` log (`:319-323`); public authwits via `setPublicAuthWit` after `ensureAuthRegistryPublished`
  (`:24, :98, :673-686`).
- A complete browser-shaped flow: `R/docs/examples/ts/token_bridge/index.ts` (339 lines): `EmbeddedWallet.create
  (node)`, `createExtendedL1Client`, `@aztec/viem` imports (`:14-15`), the hand-written `MessageSent` ABI to read the
  leaf index from the deposit receipt (`:162-198`), the proven poll + `getL2ToL1MembershipWitness` + `siblingPath
  .toBufferArray()` (`:288-338`).
- `Wallet.createAuthWit(from, IntentInnerHash | CallIntent)` is a wallet method (`aztec.js/src/wallet/wallet.ts:306`);
  the RPC schema is `{consumer, innerHash} | {caller, call: FunctionCall}` (`:369-375`), so pass
  `call: await action.getFunctionCall()` when not on a test wallet; `computeAuthWitMessageHash(intent, chainInfo)`
  (`utils/authwit.ts:79-98`).
- viem: `"viem": "npm:@aztec/viem@2.38.2"` in `aztec.js/package.json:107` and `ethereum/package.json:61`; consumers
  import `@aztec/viem` / `@aztec/viem/chains`.

## A. The API shapes the plan must use

1. **Private burn + message** (the miner's `send_ahead` / `exit_to_l1`): `self.context.message_portal(PORTAL, content)`
   then `self.call(Token::at(token).burn_private(self.msg_sender(), amount, authwit_nonce))`, nonce ≠ 0; the user
   creates `wallet.createAuthWit(owner, { caller: miner.address, action: token.methods.burn_private(owner, amount,
   nonce) })` and sends `miner.methods.send_ahead(...).send({ from: owner, authWitnesses: [w] })`.
2. **Private claim** (`claim_from_l1`): `consume_l1_to_l2_message(content, [secret], PORTAL, leaf_index)` then
   `mint_to_private(recipient, amount)`; the client: `waitForL1ToL2MessageReady(node, msgHash, { chainTip: 'proven'
   })`, then `.send({ from })`; the secret from `generateClaimSecret()` or the seed derivation.
3. **Public consume from a fixed sender** (`retire`): the public overload with `[secret]` (a public secret is fine:
   `secret = 0`, `secret_hash = compute_secret_hash([0])`); the expected sender is the portal address in
   `PublicImmutable`; double-consume fails on the nullifier check.
4. **Content hashes**: keccak-selector ‖ 32-byte words ‖ `sha256_to_field`, byte-identical in Noir (`lib.nr`),
   Solidity (`abi.encodeWithSignature` + `Hash.sha256ToField`) and TS (`sha256ToField([selector4, …])`); the
   L1→L2 leaf includes the global index, so it is read from the `MessageSent` / `DepositToAztecPrivate` event, never
   precomputed. Vectors to reuse: `compute_secret_hash([8])`, `computeL2ToL1MessageHash` (zero and (3,1,2,4,5)),
   `TokenPortal.t.sol:83-166`.

## B. Consuming an Outbox message and sending into a DIFFERENT version's Inbox, one tx — possible

1. `Outbox.consume` needs `sender.version == VERSION` of THAT Outbox: rebuild the message with the OLD version, never
   re-read the canonical rollup at consume time.
2. `msg.sender == recipient.actor`: the forwarding portal must itself be the L2 message's recipient, i.e. the miner
   calls `message_portal(PORTAL, content)` — exactly the design.
3. `block.chainid == recipient.chainId`.
4. `roots[num−1] != 0`: the old rollup's epoch must be proven with a covering root — the hard constraint on a dying
   chain.
5. `Inbox.sendL2Message` needs `recipient.version == VERSION` of the NEW Inbox: build `L2Actor(l2[successor],
   newVersion)`.
6. No caller restriction, no fee on the Inbox; the recorded sender is the portal, which the new miner expects.
7. Field-range checks on actor/content/secretHash.
8. Resolve both boxes from the Registry: `IRollup(address(registry.getRollup(OLD))).getOutbox()`,
   `IRollup(address(registry.getCanonicalRollup())).getInbox()`.
9. Gas: budget consume + insert; do not trust a bare `eth_estimateGas` (the client buffers 100 %).
10. Replay safety for free: the per-epoch nullifier bitmap keyed by leaf id.
11. The forwarded message's `secretHash` must be the user's, bound into the consumed content (the K2 content commits
    to it), so the user, not the forwarder, chooses who can claim.

## C. Timing

- L1→L2: inserted into `trees[inProgress]`, `inProgress` starts at `INITIAL + LAG` and advances as the rollup
  consumes; messages land in the first block of a checkpoint; readiness = `getL1ToL2MessageCheckpoint(hash)` ≤ the
  tip's checkpoint. LAG is a deploy parameter (2 in tests; production unknown — read it from `Inbox.LAG()`).
- L2→L1: queued by `message_portal`, in the Outbox once the EPOCH PROOF lands; partial-epoch roots let the node pick
  the smallest covering root; on the local network the tests force it with `cheatCodes.rollup.advanceToEpoch` +
  `waitForProven` (timeout 300 s), then retry the witness for up to 60 s.

## D. Gotchas the tests work around

1. `numCheckpointsInEpoch` is per witness; carry the whole `L2ToL1MembershipWitness`.
2. Path lengths vary (four unbalanced trees); never hardcode a height; `leafId` derives from the path length.
3. The node throws on a local/Outbox root mismatch rather than returning a bad witness.
4. Duplicate identical messages in one tx need `messageIndexInTx`.
5. Check `hasMessageBeenConsumedAtEpoch` before spending gas.
6. The designated caller is inside the content hash: a wrong `caller_on_l1` yields an unconsumable message.
7. L1→L2 hashes cannot be precomputed (the index is inside); read the event.
8. `getL1ToL2MessageMembershipWitness('latest', msgHash)` is the fallback for a lost index (two args in 5.2.0).
9. Secrets: reuse does not brick claims (the index is in the message hash) but links deposits publicly; a fresh
   secret per message; the node never sees secrets. `claim_private` reveals the amount.
10. Authwit nonces must be non-zero and unique per use; failure reads `Unknown auth witness for message hash …`.
11. Public authwits need the auth registry published (`ensureAuthRegistryPublished`).
12. `TokenPortal.initialize` is unguarded; a production portal takes immutables / an owner.
13. Nothing advances an automined local chain by itself: plan a "nudge" utility (two cheap L2 txs).
14. `MAX_L2_TO_L1_MSGS_PER_TX = 8`.
15. The FeeJuice contract's `consume_l1_to_l2_message(…, secret, …)` (a bare Field) disagrees with the only
    definition (`[Field; N]`); copy the token bridge's `[secret]` form.

## Unknown / not found

- The test file that invokes `uniswapL1L2TestSuite` / calls `withdrawPrivateFromAztecToL1` (no grep; the suite
  factory `shared/uniswap_l1_l2.ts` and the harness carry everything cited). `e2e_cross_chain_messaging/` does not
  exist in 5.2.0.
- The NFT-bridge example's Solidity/Noir sources behind `docs/examples/ts/token_bridge/index.ts`.
- Whether `@aztec/viem@2.38.2` differs from upstream viem; pin the fork verbatim.
- `CheatCodes.rollup.advanceToEpoch`'s implementation (`@aztec/aztec/testing`) — call site only; see
  `research/aztec-upgrade.md`.
- `MerkleLib.verifyMembership`, `FrontierLib`, `IRollup.sol` not read directly.
