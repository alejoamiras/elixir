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
