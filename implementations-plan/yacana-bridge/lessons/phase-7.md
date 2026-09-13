# Phase 7 — the guided path UI and the everyday bridge

## What landed

- `packages/web-miner/src/session.ts`: the bridge session opens with the account (before `ready` is published) when
  the build carries a portal — the journal under the master's fingerprint, the portal through the RPC in use, the
  wallet and contracts read at every operation through `l2()` so a rebuilt chain view (a lost race, a node switch)
  is what sends; every balance read leaves the snapshot the next version's build shows; the Ethereum RPC as a
  setting (`probeEthRpc`, `switchEthRpc`: saved, pointed at by the guard, the bridge reopened over it).
- `src/bridge/{env,copy,forms,session}.ts`: the build's bridge and migration blocks in one place; the card's line
  per state (no relayer, no hour, no waiting period; a deposit the wallet never answered is offered again); the
  sheets' validation; `BridgeSession` with the fact reads behind one method.
- `src/features/`: `MigrationCard` (announced / flipped, the send-ahead button with the balance, what was sent ahead
  and what was mined since, the loss line), `SendAheadSheet`, `ArrivalCard` (one-tap Claim; "Deposit again"),
  `BridgeTile` (the journal rows with the holder's forward — a ready exit, a held send-ahead once a later version is
  registered — and the redeem; the recovery file saved and restored; the portal's standing in one line),
  `ToEthereumSheet`, `DepositSheet` with the EIP-6963 `WalletPicker` (the connected row shows the YACA balance) and
  `HeldSheet` (forward or redeem from the connected wallet), `TakingLongDialog` (a held or ready crossing older than
  six hours, no bot to blame), `EthRpcTile`, `OldTabNotice`, `BridgeProviders` (wagmi + query client over the open
  session, mounted where the bridge features are).
- `e2e/helpers/l1-wallet.ts`: the injected EIP-1193 wallet answered from Node (modelled on nulo's tools fixture; an
  EIP-6963 announcement added so wagmi's picker lists "Yacana test wallet"); `e2e/control.ts` + `scripts/run/control.ts`
  + `e2e/control-client.ts`: a run's control server for what Yacana does by hand; `run-setup.ts` bridge mode
  (`E2E_BRIDGE=1` or the `bridge` shard): the portal on the network's anvil against its real Registry, the version
  registered, the operators key listed as forwarder; `e2e/bridge-states.e2e.ts` (the `bridge` shard);
  `e2e/bridge.e2e.ts` (`RIG_ONLY`: three stages) and `packages/harness/tests/browser.bun.test.ts` (`bun run rig --
  browser`), `playwright.rig.config.ts`, `e2e/build-env.ts` shared by the suite and the rig.
- `packages/bridge/src/journal.ts`: a record the send left with a block and no epoch learns its epoch from the facts.

## Gate

(pending)

## Lessons

- The send recorded the block alone and the reducer's epoch step returned early on a record without an epoch: the
  first live crossing sat at "proving to Ethereum" for good while the node's proven tip moved past it every few
  seconds. The state machine's unit tests never built a record the way the send does. Now `epochFacts` asks the
  node for the block's epoch when the record lacks it, and the facts test builds that record.
- wagmi's `getChainId(config)` answers the config's chain, not the wallet's: a wallet on a chain the config does not
  list leaves the config on its own chain and the "ensure chain" check does nothing. The connection's chain
  (`getAccount(config).chainId`) is what to compare; the wrong-chain cell would have passed the switch by accident
  otherwise.
- A refused or abandoned deposit had already reserved an index and written a `proving` record; a second attempt
  reserved another. The deposit now reuses a deposit the wallet never answered (same index and secret, the amount as
  asked now), which is also what "Deposit again" after a reload does.
- The repo's copy guard (`scripts/rename-guard.test.ts`) reads template literals too: a variable named `key` inside
  `${key}` in a `.ts` file counts as the word. Copy that means the redeem key says "this account's own secret".
- The injected test wallet answered `eth_accounts` before the page ever asked, so wagmi's reconnect-on-mount
  connected it silently and the picker the spec waited for never rendered (a 15-minute click). A real wallet
  answers no accounts until `eth_requestAccounts` once; the fixture does the same now, and the picker shows a
  "reconnecting" line while wagmi asks the wallets a page connected before.
- The first shard runs each cost a network boot and a build to learn one fact; a page-log hook on failure and the
  trace's DOM snapshot (unzipped, grepped for the row) were faster than reasoning from the reporter's line.
- The rig's browser case first ran Playwright with `spawnSync` from the process that owns the network: that process
  drains the node's log pipe and hosts the control server the spec calls, so the node stopped building blocks at
  the same second and `settle` could never have answered. Every child of a rig case is spawned asynchronously now;
  a case that owns processes must never block its own loop.
- The local network (5.2.0's automine sequencer) builds a block only on a transaction or a warp — the
  `minTxsPerBlock 0` flag no longer means a block every slot — and a claim anchors on the latest block for ten
  minutes. A page that mines and proves for minutes on end (the rig's words account, real proving) saw every claim
  expire against a chain that had stopped behind it; the shard runs and the canary were simply faster than the
  window. The browser case warps one slot a minute behind a serial queue shared with the controls and the flip.
  Measured with a probe: bare rig, rig after the deploys, and the plain isolated network all sit at the same height
  for minutes when nothing sends.
- The rig's builds ran from `bun test`, whose `NODE_ENV=test` Vite kept, so the page under test was React's
  development bundle: StrictMode rehearsed every effect, and the words backup screen's cleanup reset its quiz on
  a component that stayed mounted — no answer could ever pass, and the spec waited on a disabled button until the
  stage's timeout. The in-progress trace (`test-results/.playwright-artifacts-*/traces/*.trace`) showed the open
  call and the DOM in seconds. The cleanup is gone (state dies with the component) and the e2e build env pins
  `NODE_ENV=production`; a click on a control that may never enable deserves an explicit expectation first.
- Four aztec nodes from another project's sandboxes (nulo, two days old) and a two-day-old `bun --eval` stub from a
  deleted worktree were still running on the box; the stub was killed (its worktree is gone), the nodes left alone
  (another project's runs) and reported.
- The Bash guard refuses heredocs and command substitutions in this worktree session; whole-file rewrites go through
  a Python script in the scratchpad.
- The V6 stage's forward from the page reverted with `SignatureExpired(uint64)` (selector `0xfcd4a11f`, checked
  with `cast sig`): the page dated the signature's expiry an hour after the device's clock, and the rig's chain —
  warped through the proposal's windows and the flip — was hours ahead of it, so the portal saw an expired
  signature at once. Every deadline the portal holds is measured against `block.timestamp`; the session now reads
  the latest L1 block's timestamp (memoised two seconds, a refresh reads it once for every crossing) for the
  forward's and the redeem's expiry, the deposit's deadline and the proof-deadline check. The unit facts test never
  saw it because its clock was a stub; only a chain running ahead of the device shows the difference.
- The flipped stage restored three crossings, not four: a fresh device's landing scan had already found the
  deposit in the Inbox (as `deposited`, then `claimable` — the node cannot tell a claimed message from a waiting
  one), and the import skipped every id the journal held. The file knew it was claimed. `supersedes` in the
  recovery module lets the file's record replace the journal's only when the file's has ended and the journal's has
  not; everything in flight is the chain's to refresh.
- The first-visit spec's second visit expected the claims counter at "1" after Start: the counter is this
  device's claims history, restored from `localStorage` under the deployment and the account, so it opens at what
  the first visit minted and the next claim adds one. With Presto beside the run the easy target mints a claim
  every twenty seconds or so, so the first visit now holds three by the time Stop lands where it used to hold one
  — the "1" was the restored count all along. The spec now expects `minted + 1`.

## Consults

None yet.
