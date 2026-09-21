# web-landing

The landing at `/`: what YACA is, the money rules against Bitcoin and Zcash, what the chain sees, how it works, the
live strip, the verify chips and the ask. Static copy (`src/copy.ts`, every sentence on the page), plus one thing
that runs: the live strip, read from public storage through the same reader as the stats page.

## Launch mode

`VITE_LAUNCH_MODE=1` (in `deployments/site.env`) makes the hero the launch lottery: a countdown to `launch_at`
from the genesis slot, the reveals so far from the lottery slots, and "Commit my entropy", which links the
`bun run launch -- commit` documentation. For mainnet's launch week.

## Run it

```
bun run --cwd apps/web-landing dev        # fetches the CRS, copies the artifacts, the slot table and layouts, then Vite
bun run --cwd apps/web-landing build      # the production bundle (dist/, with _headers)
bun run --cwd apps/web-landing og-card    # renders public/og.html to public/og.png (committed)
```

## Tests

```
bun run --cwd apps/web-landing test:components                   # Vitest: the sections in order, the demo run
                                                                     # with a fake Worker, launch mode
bun run e2e:agent -- bun run --cwd apps/web-landing test:e2e     # Playwright on an isolated network: nothing of
                                                                     # the prover before the click, a real proof with
                                                                     # its step times, no request elsewhere, the phone
```
