# web-stats

The observatory (`/stats`) and the deployment record (`/stats/verify`): everything the chain knows about the
mining, read straight from public storage on the node you choose. No wallet, no PXE, no prover, no indexer.

## What it reads, in order

1. The deployment check (`assertDeployment`): both instances and classes on the node, the miner's bound token.
2. `open_epoch`, then the slot chunk(s) for the last 48 epochs (`public/slots/<chunk>.json`, generated at build
   time from the storage layout: the map slots of `epochs[e]` and `claims[e]` for 262 144 epochs, 512 per chunk),
   then three `getPublicStorageAt` per epoch (target, opened_at, claims), eight in flight, 10 s each.
3. The token's `total_supply`, `genesis`, the launch lottery, the latest block (the freshness line).
4. Every 30 s: the open epoch, its row and the one before (a close since the last read), supply and block.
   "Load older" reads the previous 48. `?epoch=N` selects an epoch; ← → step through the loaded rows.

Every number comes with the line that says where it comes from; the closing block says what a stats page for this
token cannot show (miners, rates, who claimed what, balances).

## Run it

```
bun run --cwd packages/web-stats dev        # generates the slot table and layouts, then Vite
bun run --cwd packages/web-stats build      # the production bundle (dist/, with _headers)
```

## Tests

```
bun run --cwd packages/web-stats test:components                     # Vitest: charts, the strip, the URL selection
bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e       # Playwright on an isolated network: the captured
                                                                     # history through a mocked node, a deep link, the live deployment + Verify
```

## The screenshot gate

`bun run --cwd packages/web-stats test:visual` renders the observatory on the captured history (`e2e/visual-rpc.json`
answers every JSON-RPC call; no node) at 1280, 1440, 1024 and 390 inside the pinned Playwright image
(`mcr.microsoft.com/playwright:v1.62.1-noble`, through Docker locally, the job's container in CI) and compares each
full page with `e2e/__screenshots__/` at zero tolerance. A changed token, padding or mark colour fails the PR gate
with the expected, actual and diff images as the workflow's artifact.

Update the baselines in a reviewed PR: `bun run --cwd packages/web-stats test:visual --update-snapshots`. Re-record
the answers after a change to what the page reads: `bun run e2e:agent -- bun packages/web-stats/e2e/visual-setup.ts
record`.
