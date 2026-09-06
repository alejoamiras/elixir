# yacana web miner

A browser page that mines yacana: it owns an embedded Aztec wallet (account created on the first
visit, keys in IndexedDB), proves the work circuit with bb.js in a Worker, and when a ticket wins
proves the private `claim` in-page and mints the reward to its own private balance. Fees go
through the sponsored FPC.

## Run it

```
bun run --cwd packages/web-miner dev      # fetches the pinned CRS, copies the artifacts, starts Vite
bun run --cwd packages/web-miner build    # same, then tsc + vite build → dist/
```

The page fetches the committed contract and work-circuit artifacts (`bun run artifacts:commit` refreshes
them from a compile). Its configuration is `packages/site/site.env` plus `deployments/<profile>.json`
(`docs/deployments.md`); the node picked in Settings is kept in `localStorage`; `?node=&miner=&token=`
overrides exist only in e2e builds on `localhost` (that is how the E2E points a page at an isolated network).

## What it does, in order

1. Verifies the pinned CRS (`crs.lock.json`) and installs a `fetch` interceptor: bb.js's CRS downloads are
   answered from `/crs` on this origin, never from the CDN (the production CSP blocks it).
2. Checks `crossOriginIsolated` (COOP/COEP from the one policy in `packages/site/src/headers.ts`, rendered
   into `_headers` for production and sent by the dev and preview servers).
3. Opens the wallet (a PXE store per rollup, an in-memory wallet DB; the key comes from a passkey's PRF or
   the twelve words, see the plan), registers the sponsored FPC, the miner and the token.
4. Reads the open epoch every 10 s and the private balance. A node silent for a minute pauses mining; its
   first answer resumes it.
5. Start: a fresh per-epoch secret, then the Worker proves W per nonce and hashes each proof into a ticket.
   An epoch switch mid-proof discards the in-flight nonce and rotates the secret.
6. A winning ticket becomes a `claim` transaction proved in-page with the network's per-tx maximum gas
   declared (the closing claim of an epoch costs more than the wallet's estimate would cover). The loop
   header follows it: proving → sent (the sequencer's expiry counted down) → waiting → the transaction's
   effects (the ticket's nullifier, the mint's note hash, the claim count).
7. A claim that lost a race reverts in public and leaves the PXE's note delivery stuck until L1 finality; the
   miner rebuilds the key's chain view from the chain (drop the PXE namespace, reopen, re-register, re-sync)
   and resumes, or pauses until finality if that does not unblock it. An expired claim just keeps mining.
   Residual: one device per key at a time.
8. After `T_MAX` without a close, the Roll button (anyone may call it) closes the epoch at ×4.

## Tests

```
bun run test:components                                             # Vitest: reducer, forms, shell
bun test packages/web-miner                                         # bun: vault, kv store, withdraw review, lost-race recovery
bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e      # Playwright in headless Chromium on an isolated network, against a production build
E2E_SERVER=dev bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e   # same, on the dev server (readable stacks)
```

## Deploy

The miner ships at `/mine/` of the assembled site (`bun run site:build`, `packages/site`), built by
Cloudflare Pages from `main`; `wrangler.jsonc` here is for local `wrangler pages dev dist` parity only.

A hosted page can read this tab's secret, proofs and recipient choice — inherent to any hosted dApp; run
your own build if that matters.
