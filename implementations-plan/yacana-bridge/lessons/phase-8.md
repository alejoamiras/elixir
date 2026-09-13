# Phase 8 — the versioned origin

## What landed

- `packages/site/src/assemble.ts`: each role lands in its own directory (`dist` for the apex Worker, `dist-old` for the
  versioned origin's Worker) and a production build refuses the other pairing; `build.json` carries `role`,
  `rollupVersion` and `miner`; `/faq` waits for arc 4. `packages/site/v5/wrangler.jsonc`: the `yacana-v5` Worker
  (`v5.yacana.network`, `../dist-old`, SPA fallback, the old preview suffix).
- `packages/web-miner`: `features/Retired.tsx` (the old role's cockpit head in place of the loop tile), `isOldRole()` in
  `bridge/env.ts` and the session's inert Start under it, the key screen's host note where a host restores but never
  creates, `OldTabNotice` asking the served record on every return to the tab and once after load.
- `packages/site/e2e`: both roles assembled and served (`localhost`, `v5.localhost`), the spec checks the same headers,
  `build.json.role`, the old miner's retired head and restore-only key screen, and the old-tab notice on a same-rollup
  redeploy. `packages/harness/tests/origin.bun.test.ts` + `e2e/origin.e2e.ts`: one passkey across the apex and the
  versioned origin on the rig.
- Vitest: `versioned-origin.vitest.tsx`.

## Gate

`bun test packages/site` 75/75 ✓ · `bun run site:build` ✓ (`dist`, `build.json.role = apex`) · `YACANA_APP_ROLE=old
bun run site:build` ✓ (`dist-old`, role `old`) · `bun run e2e:agent -- bun run site:e2e` 3/3 ✓ (both roles under
`wrangler dev` on `localhost` and `v5.localhost`: one header policy, `build.json.role`, the retired head and the
restore-only key screen on the old role, the old-tab notice on a same-rollup redeploy) · `bun run rig -- origin` ✓
(20.9 s: one passkey registered on `https://yacana.test`, signed in on `https://v5.yacana.test`, the same account).

## Lessons

- Browsers resolve `*.localhost` to loopback and Vite's preview admits it by default, which is enough for the
  site's e2e (no passkeys there). WebAuthn does not accept `localhost` as a registrable suffix of `v5.localhost`
  ("The relying party ID is not a registrable domain suffix"), so one authenticator across the apex and the
  versioned origin needs a real-looking domain: the rig's origin case serves `yacana.test` and `v5.yacana.test`,
  resolved to loopback with Chromium's `--host-resolver-rules`. A plain-http made-up domain is no secure context,
  and the headless shell ignores `--unsafely-treat-insecure-origin-as-secure` (probed: `isSecureContext` false), so
  the case makes a one-day self-signed certificate (`openssl`), the e2e preview serves it (`YACANA_E2E_TLS_CERT` /
  `_KEY`) and Playwright ignores HTTPS errors for that run. Bun's `fetch` takes `tls: { rejectUnauthorized: false }`
  for the readiness probe.
- Two `wrangler dev` side by side need distinct inspector ports (the default 9229 is taken by the first) and the
  second's readiness must be probed through `localhost` like the first's.
- The port registry handed out a port a sandbox it never registered was listening on; `claim` now binds each
  candidate on both loopback addresses before handing it out.

## Consults

None yet.

## Arc 3 fix loop (plan.md §10 steps 2–3)

**Round 1** — `/codex high` (GPT-6 Astra), session `01a099f5-9224-7002-bfad-985a9e5d2ce0`, over
`git diff bridge-harness...HEAD` (P6–P8, 110 files), plan.md §6 P6–P8, §8, §4, the arc map, the adversarial ask
and both verbatim rules. Verdict: "changes required — several recovery and authorization gaps survive the
happy-path gates", confidence high; eight high, six medium, one low; four reproduced with Bun scripts. Every
claim checked against the code; thirteen real, two overstated. Applied (commit `0caa02d`):

- **High** — the journal keyed rows by crossing id alone (no owner in the key): a second account's first
  crossing of the same kind replaced the first's. Rows are keyed by `[scope, id]` (IndexedDB version 2, a
  version-1 store's rows carried over); the store test opens a version-1 database and reads it through.
- **High** — a crossing restored from a file or found in the portal's events never reserved its index here: a
  fresh device handed index 0 out again and overwrote its recovered deposit. `reserveThrough(version, index)`
  moves the counter past every adopted crossing.
- **High** — a deposit the wallet answered after the page closed stayed `proving` (the landing kept the journal's
  record whole) and was offered again with the same secret. `matchArrivals` now feeds the event to the reducer for
  a record that has not reached it (`BEFORE_ARRIVAL`), and leaves a later one alone; the landing walks windows of
  indices until a silent one, runs every fourth refresh, and keeps only sends forwarded into this version.
- **High** — a send stored its hash only after inclusion; a page closed during the wait left `proving` without a
  hash forever. The hash is written the moment the node has it (`NO_WAIT`, then `waitForTx`), and a record still
  without one is found by its tag in the miner's log (`txByTag`, `Facts.tx.txHash`).
- **High** — `claimed` always answered undefined; a claim made on another device showed as claimable, and a
  claim included then pruned with its epoch stayed "minted" for good. The claim is read from the nullifier tree:
  `siloNullifier(miner, poseidon2([leaf, secret], MESSAGE_NULLIFIER))` — the derivation aztec-nr's
  `consume_l1_to_l2_message` uses (`aztec/src/hash.nr`), which the SDK ships as
  `computeFeeJuiceMessageNullifier`. A minted record younger than three hours is asked again and goes back to
  claimable when its nullifier is gone.
- **High** — every crossing's proofs and receipts were read from this build's rollup and node whatever its
  version; an unsettled V5 crossing on V6 could be misread. The rollup is the crossing's own (`rollupOf(version)`
  from the Registry, `rollupFor` memoised); the node is asked only for this build's version. The served witness
  archive is arc 4's P10, as planned.
- **High** — the recovery file was trusted past its parse: no ownership, no witness-versus-card agreement, no
  size bound; a file's terminal state could hide a live crossing. `parseCrossing` refuses a witness that does
  not describe its crossing; the import re-derives each witnessed crossing's aux (K1 tag, K2 secret hash) from
  the master and refuses a foreign file whole; `MAX_RECOVERY_BYTES` bounds the file before it is read; the import
  adds only what the journal lacks and lets the chain settle states (`supersedes` is gone — the nullifier read
  makes it unnecessary).
- **Medium** — a refresh read a record, awaited the network and `put` it back, over an operation that landed
  meanwhile. `reread` applies its reading through `update` only when the stored record is the one read.
- **Medium** — wallet writes named neither account nor chain; wagmi skips the chain check without a `chainId`.
  `pinnedSigner` names both on every write.
- **Medium** — the flip did not stop mining, `useResumeOnOpen` bypassed the session's Start, and an old-role build
  on a preview host could create an account. The session stops the controller on `flipped` and refuses every
  Start; the resume goes through the session; `keysAllowed` restores only under the old role on any host.
- **Medium** — a stale tab only warned. Every operation begins by fetching the served `build.json` and refusing
  when this tab's deployment is not the one served; `servedBuild` and `staleTab` moved to `bridge/env.ts`.
- **Medium** — copy: "it lands when the pause ends" and "keeps its place in line" promised what nothing does;
  after the flip "waiting for headroom" reads "over the cap: the version's exit capacity is used up"; the
  send-ahead review names the epoch's proof and the undone burn.
- **Low** — comments: the plan reference in `copy.ts`, the receipt-interface narration in `flows.ts`, the rig
  history in the clock's comment.
- **Also** — a deposit is refused when the portal routes this version to a miner other than this build's; a
  forward from the page goes only to the announced Registry index when the build announces one.

Not applied, with reasons: the forward's target cannot be checked against "the record" — the migration record
names the announced Registry index, not the next miner (the next deployment's record does not exist when the old
build ships), and the portal itself computes the target from the Registry and requires Yacana's registration,
so a lying RPC can only make the signature fail; the announced-index check is what the page can add. "Track
claim inclusion separately, finalise after settlement" — done by re-reading the nullifier for three hours
rather than a new state. (Both were overturned in round 2.)

The bridge shard passed on the round-1 code; the rig's browser case did not: the flipped stage restored three
crossings (the landing had found the deposit and the file no longer overrides), and the V6 stage showed two
arrival cards — the imported V5 deposit, `minted-l2` in the file, was re-read against V6's nullifier tree, found
absent, and demoted to claimable. Codex named the same defect from the diff.

**Round 2** — resumed session, over `git diff 2057125..HEAD`. Verdict: "changes required — recovery and
concurrency fixes remain incomplete", thirteen findings, four reproduced. All thirteen real. Applied (commit
`c500119`):

- **High** — the round-1 answer on the forward's target was wrong for an actual wrong registration: a
  send-ahead's forward is now offered and made only on the version it lands on (the build's own, whose record
  names the miner the portal must route to — `registeredHere`), never from the old origin; an exit's forward
  signs a zero target, as the portal checks (`forwardOne` sets `target = 0` for kind 1 — the page had signed the
  canonical version, an invalid signature the rig never exercised because the control forwards exits).
- **High** — an uncertain deposit reused its secret: the hash is kept the moment the wallet returns it
  (`onSent`), a deposit with a hash is never re-sent, and a resend takes the amount Ethereum saw.
- **High** — the claim re-check was neither durable nor destination-scoped: `landsHere(c)` scopes `messageReady`
  and `claimed` to the crossing's destination; a minted record is re-read on every visit until its claim's
  epoch is proven (`claimBlock`, `claimSettled` in the journal and the file).
- **High** — `adopt` compared against a record fetched after the stale landing result and could roll a claim
  back: `store.adopt(c, apply)` stores the row as `apply` says over the stored one and reserves the index in the
  same transaction; `matchArrivals` returns the arrival and `landed` applies it to the stored record.
- **High** — an imported ended state was final on arrival: `asHint` imports it as the state before, and the
  chain confirms the end; a crossing of another deployment inside the file is refused.
- **Medium** — `txFacts` never called `tx` for a hashless send; the tag lookup is reachable now.
- **Medium** — a silent arrival window proved nothing after twenty exits: the walk continues past every index the
  account is known to have used (`indicesInUse`: the journal, the counter, the chain's exit scan).
- **Medium** — the announced-index check refused exits: destination checks apply to send-aheads only.
- **Medium** — the old role restored on unknown hosts: eligibility first, the role's restriction after.
- **Medium** — the controller's own resumes bypassed the flip: `retire()` latches; `start()` refuses after it.
- **Medium** — the stale-tab gate ran before the queue wait: `preflight` runs once the queue reaches the
  operation, and asks the RPC once more.
- **Medium** — the cap line recommended a redeem the same cap refuses; reworded.
- Comment: "the burn is real once sent" corrected.
