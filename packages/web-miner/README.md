# elixir web miner

A browser page that mines elixir: it owns an embedded Aztec wallet (account created on the first
visit, keys in IndexedDB), proves the work circuit with bb.js in a Worker, and when a ticket wins
proves the private `claim` in-page and mints the reward to its own private balance. Fees go
through the sponsored FPC.

## Run it

```
bun run --cwd packages/web-miner dev      # fetches the pinned CRS, copies the artifacts, starts Vite
bun run --cwd packages/web-miner build    # same, then tsc + vite build → dist/
```

The page needs the compiled contracts and work circuit (`bun run codegen && bun run contracts:compile`).
Build-time defaults come from `VITE_AZTEC_NODE_URL`, `VITE_ELIXIR_MINER`, `VITE_ELIXIR_TOKEN`
(`.env.production` for the public testnet, see `docs/deployments.md`); the Network card edits are kept in
`localStorage`; `?node=&miner=&token=` in the URL override both (that is how the E2E points a page at an
isolated network).

## What it does, in order

1. Verifies the pinned CRS (`crs.lock.json`) and installs a `fetch` interceptor: bb.js's CRS downloads are
   answered from `/crs` on this origin, never from the CDN (the production CSP blocks it).
2. Checks `crossOriginIsolated` (COOP/COEP: `public/_headers` in production, the Vite config in dev).
3. Opens the wallet (persistent IndexedDB stores per chain id), registers the sponsored FPC, the miner and
   the token; creates the account on the first visit.
4. Reads the open epoch every 10 s (optionally cross-checked against a second node: a lying node can waste
   work, never steal — claims are verified on-chain) and the private balance.
5. Start: a fresh per-epoch secret, then the Worker proves W per nonce and hashes each proof into a ticket.
   An epoch switch mid-proof discards the in-flight nonce and rotates the secret.
6. A winning ticket becomes a `claim` transaction proved in-page with the network's per-tx maximum gas
   declared (the closing claim of an epoch costs more than the wallet's estimate would cover).
7. After `T_MAX` without a close, the Roll button (anyone may call it) closes the epoch at ×4.

## Tests

```
bun run test:components                                             # Vitest: reducer, formatting
bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e      # Playwright in headless Chromium on an isolated network
```

## Deploy

Cloudflare Pages, manually: `bun run --cwd packages/web-miner build && wrangler pages deploy dist`
(`wrangler.jsonc`). `public/_headers` carries COOP/COEP and the CSP.

A hosted page can read this tab's secret, proofs and recipient choice — inherent to any hosted dApp; run
your own build if that matters.
