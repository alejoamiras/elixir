# Lessons — arc 2 (miner)

## P2.1 Site tooling + M1 shell (2026-09-05)

**Result:** ✓. `packages/site` (`site.env` = node, allowlist, `VITE_RP_ID=yacana.network`; `config.ts` merges it with
`deployments/<profile>.json`, production ignores the process env, e2e/dev may override every value; `headers.ts` renders
the one policy for dev / preview / production; `vite-base.ts` = shared bb.js-aware Vite config with `define`, the
rendered headers on both servers and an emitted `_headers` in every build output; `scripts/{fetch-crs,copy-artifacts}.ts
<public dir>` + `crs.lock.json` moved here; wrangler 4.127.1 exact (4.129.0 is younger than 7 days)). The web miner:
`vite.config.ts` is three lines; `.env.production`, `public/_headers`, `csp.test.ts` deleted; `config.ts` drops the
cross-check and honours `?node=&miner=&token=` only when the build set the e2e flag AND the host is `localhost`; the node
is the only user-editable connection value; `chain.ts`/`controller.ts` lose the cross-check; `boot.ts` runs
`assertDeployment` (new `miner-core/src/reader.ts`: chain id, rollup version, both instances + classes, the miner's
bound `token` slot); routes on `history` + `popstate` (`/mine`, `/mine/wallet`, `/mine/settings`, base-aware); the shell
(brand mark, nav, testnet badge, one StatusPill); host rules (alias → redirect, preview / unknown → banner, keys only on
the RP host or localhost in non-production builds); desktop-only screen (`< 900 px` or coarse pointer without SAB);
`tab-status.ts` (title `▸ · 18/min · 2/4 · Yacana`, SVG favicon per mark state).

- **RP ID spike (Playwright + CDP virtual authenticator, ctap2_1 + PRF):** `127.0.0.1` → `SecurityError: This is an
  invalid domain`; `localhost` → credential created, `prf.enabled=true`, 32-byte result. E2E servers bind `localhost`
  and the e2e build sets `VITE_RP_ID=localhost`.
- **`style-src` audit:** Radix sets inline `style` attributes and Sonner injects a `<style>` element, so
  `style-src 'self'` + `style-src-attr 'unsafe-inline'` would break the toaster. `'unsafe-inline'` stays, documented in
  `headers.ts`.
- `host.ts` must read `import.meta.env.VITE_RP_ID` per call, not at module load, or `vi.stubEnv` cannot vary it (and a
  `define`d constant hoisted into a module-level const is the same value anyway).
- The malformed-RPC spec now points the page at the mock origin through `?node=` (allowlisted by the e2e build); the
  four cross-check specs are gone with the feature. The miner-core live test deploys two throwaway instances and
  checks that every drift (chain, rollup, class, foreign miner, foreign token) is refused: 71 s on the isolated network.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · site + web-miner `typecheck` ✓ · `bun test` 61 ✓ · `test:components` 15 + 27 ✓ · E(web-miner) 4 passed (2.9 min) ✓ · plus `e2e:agent -- bun test packages/miner-core/src/reader.live.test.ts` 1 pass.

## P2.2 Cockpit, power, settings (2026-09-05)

**Result:** ✓. `miner-core/src/metrics.ts` (score, difficulty, proofsPerMinute over 20, nextWinSeconds, closePreview,
escapeHatchIn; `difficulty`/`expectedSecondsToWin` left `format.ts`), the Worker reports `score` + `win` per attempt and
takes `reconfigure`; its scheduling is now `prover-loop.ts` (pure, backend injected) so the resume rule is unit-tested:
finish the proof in flight → destroy + init → the same job continues at `nextNonce` with the same secret; a `stop`
during a reconfigure rebuilds without resuming; an idle reconfigure rebuilds at once and a job arriving meanwhile
waits. The reducer carries score/best/samples/winAt/ledger (200 lines, ★ ✓ ✗ ── grammar with clocked events).
Cockpit = LoopTile (pill, per-proof time, Start/Stop, ScoreLoop, the three numbers), RailTile (EpochRail with the
close preview / hatch rows and the PowerSlider), LedgerTile, the key tile; Settings = Performance / Behaviour /
Appearance / About / Network in `yacana.settings`; hotkeys Space · [ ] · w · ,; battery and hidden-tab pauses with
auto-resume; resume on open.

- **The memory gate must not include a claim.** On the easy E2E target a claim proof (ClientIVC in the PXE, ≈ 2 GB)
  lands between reconfigures; the first run showed +690 MiB and would have condemned the in-place rebuild. `run-setup`
  now deploys a second instance at an impossible target (`1 << 64`) and the spec pins the page to it: three rebuilds
  (5 → 1 → 11 threads) grew the process tree by **221 MiB** (1402 → 1623), under the 300 MiB gate, so the in-place
  `reconfigure` stays (no respawn fallback).
- `bb.js` does not export its `package.json`; the version is a `define` (`VITE_BB_VERSION`) read by the site config.
- A mapped "boolean keys of Settings" type picks up `undefined` from the optional `threads`; an explicit `BOOLEANS`
  tuple is the honest type.
- `low128 < target` is `score > difficulty`, not `≥`; the reducer takes the Worker's `win` flag instead of comparing
  floats.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `typecheck` ✓ · `bun test` 69 ✓ · `test:components` 20 + 27 ✓ · E(web-miner) 5 passed (4.9 min; the new spec: three reconfigures, ledger grows, RSS +221 MiB) ✓.

## P2.3 Passkey keys + vault (2026-09-05)

**Result:** ✓. `miner-core/src/keys/derive.ts` (HKDF-SHA256 with the versioned labels; `masterFromPrf` 32 B in, 32 B out;
`deriveAccountFields(master, index)` 64 B per label → `fromBufferReduce`) and `keys/mnemonic.ts` (`@scure/bip39` 2.3.0
exact, NFKD-normalised, `masterFromMnemonic`), pinned by golden vectors including the **addresses** (computed offline
with `getSchnorrInitializerlessAccountContractAddress`, `@aztec/accounts`): PRF `00..1f` → account 0
`0x1362161b…474b`, account 1 `0x02979e13…0ba9`; the bip39 test phrase → `0x1d344823…ebc1`. `web-miner/src/keys/passkey.ts`
(every ceremony invariant, PRF input hashed at import, create→get fallback, `NoPrfError`), `keys/store.ts` (the vault:
records + a non-extractable AES-GCM device key in `yacana-keys`; AAD `yacana-key:v:method:id`; every open re-derives
account 0 and fails closed), `wallet/memory-store.ts` (an `AztecAsyncKVStore` for the WalletDB, run against the kv-store
package's own `describeAztecMap` suite + a WalletDB lifecycle test), `wallet.ts` around supplied fields, `session.ts`
(create / open / restore / stay-open), the key screen (card, consent, sync warning, Welcome back with one touch),
`boot.ts` split into preflight (evidence rows) → key → session.

- **The kv-store map suite is bun-only** (jest globals, not exported from the package barrel — imported by path) and the
  vault spec needs bb.js's Grumpkin for the address check, which throws `std::bad_cast` under jsdom. Both live in
  `packages/web-miner/tests/*.bun.test.ts`: bun runs them (WebCrypto + `fake-indexeddb`), Vitest excludes `*.bun.test.ts`,
  and the root `tsconfig` now includes `packages/*/tests` so they type-check with bun types. The plan said Vitest for the
  vault; the substance (WebCrypto, fake IndexedDB, AAD/IV/mode assertions) is identical.
- **LMDB range semantics**: forward `[start, end)`, reverse `(start, end]` descending — the suite pins it.
- **Chromium allows one internal virtual authenticator per environment**; the E2E helper returns the one it made so a spec
  can clear its credentials instead of adding another. A reload on `/mine/settings` reopens on the settings route, so
  the convenience-mode reopen navigates to Mine before reading the key tile.
- At rest after a first passkey boot (asserted by the E2E from inside the page): one record with `askEveryOpen: true`,
  no `sealed`, the only 32-byte hex in it is the address; no `yacana-wallet-*` database; the `yacana-pxe-*` store exists.
  Convenience mode seals the master and opens with the authenticator removed; switching back deletes the ciphertext.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `typecheck` ✓ · `bun test` 97 ✓ · `test:components` 24 + 27 ✓ · E(web-miner) 7 passed (5.5 min: miner ×5 through the passkey key screen, `passkey.e2e.ts` ×2) ✓.

## P2.4 Twelve words, wallet route, withdraw (2026-09-05)

**Result:** ✓. `features/WordsScreens.tsx` (show → written checkbox hides the words → quiz on words 3/7/11, paste
refused; restore with the hostname banner and paste allowed), `features/words-quiz.ts` (pure, Vitest), the `Session`
words flows (`newWords`, `createWithWords`, `restoreWithWords`, `markBackedUp`, `forget`), `routes/Wallet.tsx` (balance
+ claims, Receive, recovery status with the back-up nudge, keys on this device with the typed-suffix Forget, senders,
claims history), `features/WithdrawSheet.tsx` + `withdraw-form.ts` (the review snapshots the parsed recipient, mode
and integer amount; the send uses the snapshot; `recipientKnown` is worded as a warning, never a guarantee), the
controller's `withdraw` pause reason. `e2e/words.e2e.ts` (create → quiz → mine → forget → restore → same address) and
`e2e/withdraw.e2e.ts` (private to a second key on the device, public to an address, the recipient sees it).

- `AztecAddress.fromString` does not exist in 5.2.0: `fromStringUnsafe` + `isValid()` (Grumpkin x-coordinate); the
  review test walks small integers until it finds one that is in the field but not on the curve.
- `registerSender(address, alias)` needs the alias (`''`); a class field initialiser cannot use constructor parameters
  before the base call (the `Session` timer moved into the constructor).
- A reload keeps the hash route: a spec that reloads from `/mine/settings` lands on Settings, where no key tile is
  rendered. Every reopen in the specs clicks Mine first.
- **The sheet's Done bypassed the reset**: `onOpenChange(false)` closed it without clearing `step`, so the next
  Withdraw reopened on the "sent" view and the spec waited 20 min for the recipient field. One `close()` for both.
- **An idle isolated chain rejects every claim as expired**: the local network only built a block when a tx arrived,
  so after a stalled spec the PXE's anchor block was 20 min old and `anchor + CLAIM_TTL_SECONDS` was already in the past
  ("Invalid tx: Invalid expiration timestamp"). `isolated-node.ts` now passes `--sequencer.minTxsPerBlock 0`: a block
  every slot, as on the real networks.
- The words spec mined at the easy target and won on its first proof, which takes the Stop button away (claiming);
  it now runs on the impossible-target deployment like the memory spec.
- `bun run e2e:agent -- … test:e2e -- words.e2e.ts` broke the runner: it split the command at the *second* `--`
  (spawned `words.e2e.ts`, ENOENT) and, with no `error` handler on the child, never tore the node down (an orphaned
  anvil + node found 36 min later, killed by their own process groups). The runner now only strips a leading `--`
  and exits 127 on a spawn error.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `tsc -b` ✓ · `bun test` 105 ✓ (7 skipped live) · `test:components` 30 + 27 ✓ · E(web-miner) 11 passed (11.3 min; `words.e2e.ts` 33 s, `withdraw.e2e.ts` 1.7 min) ✓ (run `.run-state/e2e-p25d.log`).

## P2.5 States, lost-race recovery, resilience (2026-09-05)

**Result:** ✓. `chain.ts` `sendClaim` → `{ txHash, expiresAt, wait() }` (`NO_WAIT` send; `wait` = `waitForTx` to
PROPOSED, then `getTxReceipt(txHash, { includeTxEffect: true })`), `wallet.ts` `resetAccountView` (stop the wallet →
`indexedDB.deleteDatabase` with a 10 s grace for another tab → `openWallet` → `registerAccount`), the reducer's claim
states (`claim` proving → sent → waiting, `minted` marks until the next attempt, `notice` cards: reverted / expired /
failed / prover-dead / offline / paused, phase `recovering`), the controller's `claimFailed` → `rebuildChainView` →
`refresh` (the first read syncs the fresh PXE) → `recovered` → `start()`, the honest pause from the rollup's L1
constants (`finalitySeconds` = (proofSubmissionEpochs + 1) × epochDuration × slotDuration) when a rebuild fails or a
delivery is still blocked right after one; the offline pause (60 s of failed polls, 10 s retries, auto-resume);
notifications (block number only), the chime, Document PiP (`pip.ts`, the loop's Pop out), `miner-core/claim-failure.ts`
(+ `finalitySeconds`), `proof.ts` `ticketNullifier`, `e2e.yml` (dispatch-only evidence, 90 min), `e2e/states.e2e.ts`
(+ `e2e/burst.ts`).

- **The expiry comes from the transaction itself, not from a computed anchor.** `send({ wait: NO_WAIT })` returns
  only the hash; the proven tx's anchor header never leaves `BaseWallet.sendTx`. The wallet is created on the page's
  node client wrapped in a Proxy whose `sendTx` records `tx.data.expirationTimestamp` (the value the contract set:
  `anchor.timestamp() + CLAIM_TTL_SECONDS`, and the one the sequencer enforces). Plan deviation, same information,
  no second RPC round trip; `openWallet(node, chainId)` no longer takes the URL.
- `resetAccountView` takes the previous wallet (plan: `nodeUrl, node, chainId, fields`): the old PXE holds the
  IndexedDB connection and `deleteDatabase` blocks until it closes; `wallet.stop()` closes it.
- **Marks by value, not by index.** The chip shows the nullifier of the effect that *equals* the ticket's, recomputed
  in-page; the E2E asserts the match on the first claim and on one after the rebuild (`controller.lastClaim`).
- A delivery still blocked right after a rebuild means the PXE is waiting for L1: pause, do not rebuild again
  (`rebuiltAt` within the finality window). Covered by the bun test with fake worker + fake contracts.
- An expired claim keeps the same epoch under a fresh secret from the reducer (`mine` command), so "mining continues"
  needs no controller round trip and the "claim expired" card survives until the next winner.
- A bun test that reaches TSX through the controller cannot type-check under the root `tsconfig` (no `jsx`); web-miner
  gained `tsconfig.tests.json` (app options + bun types, `include: tests`) referenced from its `tsc -b`, and the root
  excludes `packages/web-miner/tests`.
- **The lost race in the E2E is real but deterministic**: the page's second claim is proven normally; its
  `aztec_sendTx` is held at the wire by a Playwright route while `e2e/burst.ts` (a second wallet, native bb, ~11 s per
  claim) claims the epoch closed; the release lands the real tx, which reverts in public. No timing race between two
  provers. Observed on the isolated network: revert at +0 s, "chain view rebuilt · notes recovered" 4 s later, mining
  resumed on the next epoch, and the balance stayed 4 × claims across the reset (the note minted before it came back
  through the handshake: the fresh PXE needs no sender registration). **The inference holds**; the honest pause stays
  as the fallback path (bun test).
- **The ticket nullifier in the effect is siloed** (`siloNullifier(miner, Poseidon2(DOM_NULL, digest))`), which the
  first E2E attempt learnt the hard way (four nullifiers, none equal to the inner one). First contact: 4 nullifiers
  (tx hash, ticket, delivery, handshake) and 2 note hashes (mint, handshake note); later claims: 3 and 1. The chip shows
  the mint's note hash (the first) and "+1" for the handshake's. The `ui` Stepper did not forward `data-testid`; it
  spreads its props now.
- Errors from the burst were invisible at first (stderr truncated to 300 chars, INFO noise): the claim's nested
  `mint_to_private` needs the token registered in the burst wallet too ("simulation error" from the ACVM).
- **The memory gate measured the wrong thing**: the peak of the process tree counts the old bb.js backend before the
  collector returns it, and varied 160 → 221 → 359 MiB across identical runs (one over the 300 MiB gate). The spec now
  compares steady states: a CDP `HeapProfiler.collectGarbage` + 3 s settle before the baseline and after the third
  rebuild (+168 MiB, peak 1669). A leak shows in the steady state; a peak also shows GC timing.
- A rebuild takes the reads away from the poll: `poll()` skips the `recovering` phase and `lastRead` is reset after a
  rebuild, or a slow rebuild would have counted as a node outage and parked the miner with no resume.
- Upstream: [aztec-packages#25418](https://github.com/AztecProtocol/aztec-packages/issues/25418) (filed from this
  phase; linked in `docs/roadmap.md`).
- `e2e.yml`: `workflow_dispatch` only, 90 min, `actions/upload-artifact` v5 pinned by SHA (verified against the tag),
  `test-results` kept 14 days; the header comment says why it is evidence and not a gate.
- One commit for P2.4 + P2.5: the two phases interleave in `session.ts`, `boot.ts` and the E2E helpers, and the same
  E2E run is both gates.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · web-miner `tsc -b` ✓ · `bun test` 105 ✓ (claim-failure 8, recovery 2) · `test:components` 30 + 27 ✓ (reducer 11) · E(web-miner) 11 passed (11.3 min; `states.e2e.ts`: offline 1.2 min, lost race 1.9 min; memory +219 MiB steady state) ✓.

## Arc 2 codex loop (2026-09-05)

**Round 1** (`/codex xhigh`, session `01a0739e-1754-7b70-ae03-50c89a4887f1`, `run-codex.sh` on the `arc1-ui..HEAD` diff with the arc map, the plan, the decision ledger and both rules). Verdict: "changes required"; twelve findings, all verified against the code and accepted, plus a six-item comment audit. Fixed in one commit:

- **Withdraw could be sent twice** (`session.ts`): a balance refresh failing after inclusion rejected the whole call and re-enabled Send. The send now resolves once the transfer is in a block; the refresh failure is only logged.
- **The vault's device key could fork** across two first-time tabs: `add` instead of `put`, the loser reads the winner's key (bun test: two concurrent seals both open). **Writes resolved before commit**: `withStore` now awaits `transaction.oncomplete` for readwrite.
- **"Back up now" was dead after a reopen** of a skipped-backup words key (the phrase cannot be rebuilt from the HKDF master). Words keys now seal their 16 bytes of **bip39 entropy** instead of the master (`seal`/`openPhrase`; `openMaster` derives the master from the entropy; the AAD still binds method and id, so a words ciphertext cannot pose as a passkey master). The words E2E reopens a skipped key and writes it down later.
- **A fresh device could not restore twelve words** (the create card only offered passkey restore): a third link, `restore-words`; the E2E restores onto an empty device.
- **A failed drop left a stopped wallet in use**: `recover` reopens the namespace as it was when the drop fails (`Rebound.rebuilt: false` → the honest pause on the reopened view); nothing reopenable → terminal "reload the page" (`abandonProver`). **A failed start leaked its wallet and Worker**: `startSession` stops the wallet and disposes the controller (which now terminates its Worker) on any failure after `openWallet`.
- **Expiry restarted a stale epoch and bypassed pauses**: the reducer goes idle with the card (which now survives the automatic `start`), the controller restarts on the epoch open now through `start()`, which records the resume intent when paused.
- **The classifier missed the node's own text** (`Invalid expiration timestamp`, `@aztec/stdlib` `error_texts`) and read every drop as an expiry: drops for other reasons are `other` now; fixtures added.
- **Rebuilds overlapped and a Stop could be lost** in the prover loop: rebuilds are serialised and coalesce to the latest count, a job waiting for one keeps ownership (a second job queues, a stop wins and is reported with the right nonce), `reconfigure` while a job waits coalesces instead of bypassing it. Three Vitest cases.
- **A silent node never tripped the offline pause** (no client deadline): `refresh` fails after 30 s.
- **A pause during a claim lost the auto-resume**: `pause` keeps the intent for `claiming`/`recovering`; `start()` under a pause records it.
- Comments: the duplicated `pinned-crs` doc, the false ordering claims in `createWithPasskey`, `headers.ts` (dev is looser, and says so; no review provenance), `derive.ts` (the derivation contract, no future-plan reference), `WordsScreens` (the phrase does live on in the session), `passkey.ts` (the RP ID is the trust boundary: sibling HTTPS subdomains can request the PRF).

Gate after the fixes: `bun run lint` ✓ · `typecheck` ✓ · web-miner `tsc -b` ✓ · `bun test` 115 ✓ (recovery 4, vault 5, classifier 12) · `test:components` 33 + 27 ✓ · E(web-miner) 11 passed (11.9 min) ✓.

