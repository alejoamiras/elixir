# Phase 6 — the site layer and the bridge modules in the miner

## What landed

- `packages/site`: `site.env` names the default Ethereum RPC, the Ethereum explorer, the versioned origin and the
  old-role Worker's preview suffix; `config.ts` carries them, the role (`YACANA_APP_ROLE`, apex or old, with its own
  preview suffix), and the record's `bridge` and `migration` blocks as JSON (`VITE_BRIDGE`, `VITE_MIGRATION`), with
  production refusing a plaintext or local RPC, explorer or origin; `connection.ts` keeps the RPC beside the node as
  a user setting (`?ethRpc=` in e2e builds); `node-guard.ts` gains the RPC's slot (`setEthRpcEndpoint`,
  `onEthRpcResponse`: its own deadline and listeners, never the node's gate); `eth-rpc.ts` parses, probes (the
  portal's chain, the portal's code, through a candidate lease) and folds the RPC's health; `host.ts` gains the
  `versioned` kind and `keysAllowed(host, 'create' | 'restore')`.
- `packages/bridge`: `journal.ts` (the crossing record, its states, the pure `advance`), `queue.ts`, `recovery.ts`
  (the file bound to chain + portal, parsed field by field), `deadline.ts` (the per-epoch proof deadline and the
  proven check over the Rollup), `flip.ts` (the verdict from several signals), `logs.ts` (windowed, strict log
  scans; the operator's retire uses it), `record.ts` (the record's bridge and migration block types, so the site
  never imports the deploy package).
- `packages/web-miner`: `keys/classes.ts` (the build's account class from the SDK's artifact, the pinned previous
  class, the address recipe under any class — proven equal to the SDK's — and the master fingerprint);
  `keys/store.ts` (`openAccount` verifies under the build's class, migrates a record made under the previous class
  once, by fingerprint or by the old class's address, and refuses a wrong master; `findRecordFor` for restores;
  `currentAddress`); `feePayer.ts`; `bridge/store.ts` (IndexedDB `yacana-bridge`, journals keyed by the master's
  fingerprint, the next index taken inside the crossing's transaction, the chain scan that seeds it);
  `bridge/snapshot.ts`; `bridge/eth.ts` (wagmi's injected connector with EIP-6963 discovery, the four writes, the
  portal's reads); `bridge/landing.ts`; `bridge/facts.ts`; `bridge/flows.ts`; the controller's `bridge` pause
  reason; `main.tsx` scopes the claims ledger by deployment and account.

## Gate

`bun run lint` ✓ · `bun test packages/site packages/web-miner packages/bridge` 252/252 ✓ · `bun run test:components`
(ui 49, landing 11, miner 71, stats 66) ✓ · `bun run --cwd packages/web-miner typecheck` ✓ · `bun run --cwd
packages/web-miner test:replay` 4/4 ✓ · root typecheck ✓. The vault test opens a sealed record under an unchanged
class (fingerprint and address written), migrates a legacy record under a changed class by the previous class's
address and refuses a wrong phrase, migrates again by fingerprint, and finds a record by any of the four ways; the
store test takes distinct indices for two concurrent creates and a second tab past twenty prior exits (a seed of 25).

## Lessons

- viem/wagmi's contract types collapse to `never` on one of two structurally identical `writeContract` calls when
  the ABI is large (which call fails moves with the file's order); spelling the struct's ABI type once
  (`ContractFunctionArgs<typeof abi, 'nonpayable', 'forward'>[1]`) and casting at the call sites is deterministic.
- A type-only import still pulls the module into a stricter project's program: the site's import of the deploy
  package's record types brought `Bun` and `import.meta.dir` into the miner's typecheck. Shared record types live
  in `packages/bridge/src/record.ts` now.
- `@aztec/aztec.js`'s `send` returns the receipt when it waits; a transaction hash before the block needs
  `NO_WAIT`. The flows send-and-wait for now; the wallet's own `lastSent` is the hook for a reload mid-send.
- The account address recipe: `computeContractAddressFromInstance` takes the instance *preimage* (no
  `currentContractClassId`); the initializerless Schnorr account's immutables hash is `poseidon2(signingPubKey.x,
  y)`, its initialization hash zero, its deployer zero. `classes.bun.test.ts` pins the recipe to the SDK's own
  derivation and the previous class id to the current one, so an SDK bump that changes the class fails loudly and
  the pin is moved on purpose.
- Bun 1.4 has a `localStorage` global: a "no storage" test must pass `null`, not `undefined` (a default parameter
  fires on `undefined`).
- The tagged-log query wants `Tag` objects (`new Tag(fr)`), not fields; a strict log scan (`strict: true`) makes the
  decoded arguments non-optional, which the landing needs.

## Consults

None: the design followed plan.md §3.1 and §6 P6 as written. Deviations to record: the `WagmiProvider` and query
client are scoped to the bridge features when those features exist (P7) — `wagmiConfigFor` is what they mount;
`feePayer.ts` gives every operation the sponsored payment and the claim its measured limits, the SDK's estimate
otherwise; `queue.ts` lives in `packages/bridge` (the plan named it under the miner's bridge modules) because the
operator script and the stats page share the record types and the journal, and the queue is a page-level primitive
with no browser dependency.
