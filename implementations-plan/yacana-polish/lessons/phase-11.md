# Phase 11 — Transaction proofs through Presto (arc 7, `polish-presto-tx`)

## The spike (2026-09-17)

`@alejoamiras/presto@5.2.0-revision.2` installed into `web-miner` (published 2026-09-08, past the 7-day
gate; 7 deps, all at 5.2.0; the hoisted linker resolved `@aztec/bb-prover/client/lazy` and
`@aztec/simulator/client` for it — the peer-shape blocker did not happen). `PrestoProver` is handed to the
PXE as `pxe.proverOrOptions` through `EmbeddedWallet.create` (the wallet forwards it untouched;
`isPrivateKernelProver` duck-types on `createChonkProof`). The page's guard gains `/prove` beside
`/prove/ultra-honk` (the SDK posts the serialized private execution steps there; `chonk` scheme).

One claim proved through the run's headless `presto-server` 1.1.1 on the isolated network
(`presto.e2e.ts` "a win Presto proved …"):

| where | cold | warm |
|---|---|---|
| Presto, the server's own clock (`Received /prove` → `Proving succeeded`; 45 chonk proofs in the first run, 9 circuits, 12 threads) | 5.33 s | median 5.01 s |
| the page, around `createChonkProof` (the meter's event) | 5.7 s: detect 0 · serialize 3 ms · transmit 0.3 s · proved 5.70 s · receive 5.71 s | — |
| WASM in the page (the PXE's own event, the same claim shape) | 14.7 s · 15.8 s (two proofs of the first run that fell back) | — |

Presto proves the transaction about 2.6× faster than the page; the round trip costs 0.4 s over the proof.
The bundle's size delta: see the gate. No blocker: the phase is built.

Lessons of the spike:
- The SDK's client says `proved` of a remote proof too (`presto-client.ts:497`), then `receive`; only
  `fallback` means WASM proved. The page's prover marks a proof as local on `fallback` or when it forced
  local itself, never on `proved` — the first draft did, and the meter saw no Presto event.
- `serializePrivateExecutionSteps` is msgpack over the steps' gzipped bytecode and witnesses: 3 ms. The
  witness leaves the page only here, to loopback.
- The e2e meter reads the PXE's `client-ivc-proof-generation` console event (`fixtures.ts`); the SDK's
  Presto path logs nothing the meter knows, so the page's prover logs the same event with `prover:
  'presto'` and the phases, and the breakdown gained an "on Presto" column.
- Two stale specs surfaced (`miner.e2e.ts` first visit, `presto.e2e.ts` the claim): both asserted the
  rail's `claim-slot`, which P9 removed (the claim lives on the loop's chip and the ledger since P3/P9)
  — the cockpit and chain shards did not run in arc 5's gate. Ported to `claim-chip` and the ledger's
  minted line; the phase regexes (`/^mining/`) admit the ✦ suffix beside a headless Presto.
- `ClaimStepper` and `MintedMarks` in `features/ClaimStatus.tsx` have no consumer since P9: for the
  cross-arc pass.

## Build (`dc5e51c`)

- `web-miner/src/tx-prover.ts`: `TxProver extends PrestoProver` on the page's endpoint; the UI's `onPhase`
  beside the SDK's; a proof Presto made logs the PXE's event (`client-ivc-proof-generation`) with
  `prover: 'presto'` and the phases' ms; `setForceLocal` remembered so a forced proof reads as the page's.
- `wallet.ts` `openWallet(node, chainId, prover?)` → `pxe.proverOrOptions`; `resetAccountView` passes it;
  `boot.ts` builds one `TxProver` per start when `pre.presto` is set (this build looks for Presto) and
  returns it on `Started.txProver`. `presto.ts`: `/prove` admitted by the guard; `prestoProvesTx` (the
  Worker keeps Presto ∧ `chonk` served); `txProvingAfter` (Presto from `transmit`, the page from a
  `proving` with no transmit or a `fallback`); `txProvingAtom`; `PROVING` words per prover.
- `session.ts` `bindTxProver`: `setForceLocal` mirrors the Worker's sticky `fallbackReason` (a denied or
  dead Presto is not sent a witness per proof; a rebuild that brings native back brings the wallet's
  back); the phases land in `txProvingAtom`, cleared at `proved`/`receive`.
- `features/dialogs/use-tx-prover.ts`: `useTxProver()` (the proof under way, else where the next goes)
  and `useProvingWords()`; Send's line under the button, the three dialogs' proving step (detail, foot),
  the How steps' "about N s" and the send-ahead's "With Presto, your transaction's private inputs go to
  Presto on this machine, never elsewhere"; `claim-copy.ts` `winNote(c, now, prover)` → "claiming:
  proving through Presto ✦" (`LedgerTile` reads the atom).
- e2e: `fixtures.ts` reads `prover` and `phases` off the event; `report.ts` an "on Presto" column and the
  summary's count; `presto.e2e.ts`: the claim test asserts the claim line and a 200 on `/prove`; a new
  case aborts the `/prove` transmit at the socket (`page.route`) — the claim line says the browser, the
  claim mints, one attempt (the SDK never re-sends the witness: `presto-client.ts`
  `#recoverFromNetworkFailure` falls back; the HTTP downgrade retry needs `allowInsecureDowngrade`,
  off in production's `httpsOnly`); `presto-live.bun.test.ts`: `/health` lists `chonk`, a body that is
  not execution steps comes back as the SDK's `fallback` (the server answers 500), never a proof.
- Tests: `tests/tx-proving.bun.test.ts` (the phases' table, the sticky rule, the claim words);
  `forms.vitest` (the line flips to Presto under a sticky state serving chonk); the inventory + 1.
- Copy: `boards_send.py`, `boards_mine.py` (CLAIM_LINES), `boards_bridge.py`, `boards_upgrade.py`
  re-rendered (`gen.py`, 95 boards); the brief v4.3; CLAUDE.md's web-miner row.

## Decisions and departures

- **The prover is built whenever the build looks for Presto, not from `selected === 'presto'`.** The
  plan keys the choice on the Worker's sticky state at `openWallet`; the account opens before the Worker
  exists and the probe (Start mining's) has not answered, so that key would almost always say WASM. The
  SDK's own detection decides per proof (its `/health` cached 10 s), the Worker's verdict is mirrored as
  `setForceLocal` afterwards, and `prestoProvesTx` is what the pre-proof line reads.
- **"about 5 s"**: the plan's "about N s" from this machine's measurement (5.0 s median, 12 threads);
  the browser's "about 20 s" is the same kind of number.
- **The chonk round trip in the live test is the SDK's degrade, not a proof**: a real one needs a private
  execution (a PXE and a node); the e2e's claim is that round trip. The live test checks the scheme and
  that garbage never becomes a proof.
- **`page.route` abort for "gone mid-proof"** instead of killing the run's server: the server is the
  run's, shared by the specs after this one; an abort at the socket is what a dead Presto looks like to
  the page.
- **The board for the exit's proving step** keeps its browser sentence and notes Presto's in brackets
  (one board, two states); the page's step reads `PROVING[prover].detail`.

## Gate (2026-09-17)

| layer | result |
|---|---|
| `bun run lint` | clean |
| typecheck (root, miner, stats, landing `tsc -b`, ui) | clean |
| `bun test` | 499 pass · 42 skip (one stale expectation fixed: `presto.bun.test.ts` lists the guard's routes; `/prove` joined them) |
| `bun run test:components` | ui 69 · miner 119 · stats 84 · landing 14; one miner spec (`bridge-features.vitest` "no ETH holds the button…") failed once under the full parallel run right after the e2e shard and `bun test`, then 4/4 alone and the whole miner suite green again — load flake, not P11's |
| `chain` real, headless Presto beside it | 9/9: `presto.e2e.ts` 4/4 (the claim through Presto **1 · 5.8 s** on the "on Presto" column, `/prove` answered 200; gone mid-proof: the browser's 15.9 s, one attempt, `native` still visible), `switch.e2e.ts` 2/2 (its claim through Presto too, 5.7 s), `states.e2e.ts` 3/3 after the `minted`-testid port |
| `canary` real | 4/4 (canary 14.8 s, withdraw 3 proofs 38.8 s, all WASM: see below) |
| `presto-live.bun.test.ts` against a headless server | 2/2 (`/health` lists `chonk`; garbage → the SDK's `fallback`) |
| bundle (`bun run --cwd packages/web-miner build`, `a4b94b7` → this) | entry `index` 4,907.9 → 4,908.4 kB (gzip 1,362.4 → 1,362.2); the `.wasm` files identical; `noirc_abi_wasm`'s JS glue became its own 75.9 kB chunk while `account_contract` shed 69.8 kB (the same code re-split); all JS 48,657 → 48,664 kB (+7), gzip +4 kB. The SDK's client rides on the `BBLazyPrivateKernelProver` the bundle already carried. |

The "WASM only" puzzle from the first chain run (the lost race's 3 proofs, the canary shard's 4) is by
design, not a defect: `e2e/helpers.ts` opens every page with `?presto=off` unless the spec asks for
`presto: 'on'` (`prestoEndpointFor` then returns null: no probe, no `TxProver`, the PXE's own WASM
prover). Only `presto.e2e.ts` and the switch spec opt in, and both proved their claims through Presto.
The PROVERLESS shards and the canary keep proving what they always proved.

The gate's pass condition — the breakdown's proving column shows the transaction proof on Presto, the
fallback case green — holds: `p11-chain2` breakdown `prestoProofs: 2, prestoMs: 11.5 s` over the two
opted-in claims; the gone-mid-proof case passed with `prestoProofs: 0` and one `/prove` attempt.
