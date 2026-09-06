# web-landing

The landing at `/`: what YACA is, the money rules against Bitcoin and Zcash, what the chain sees, how it works, the
live strip, the verify chips and the ask. Static copy (`src/copy.ts`, every sentence on the page), plus two things
that run: the live strip, read from public storage through the same reader as the stats page, and the demo.

## The demo

"Prove one now" runs the miner's Worker (`packages/web-miner/src/demo/demo.worker.ts`): the pinned CRS, bb.js,
one proof of the work circuit against the open epoch (its seed from the chain, a throwaway secret), the score of
that proof against today's bar. Four steps with their wall times, then the score, the bar and the odds per proof.
Nothing is sent anywhere. The Worker chunk is fetched on the click, never with the page; the E2E asserts it. On a
phone the button is not rendered: the page reads, and "Send me the link" shares the miner's URL.

Threads: `max(1, min(4, cores − 1))`. Timeout: 90 s, then an honest message. The Worker is terminated whatever
happens.

## Launch mode

`VITE_LAUNCH_MODE=1` (in `packages/site/site.env`) makes the hero the launch lottery: a countdown to `launch_at`
from the genesis slot, the reveals so far from the lottery slots, and "Commit my entropy", which links the
`bun run launch -- commit` documentation. For mainnet's launch week.

## Run it

```
bun run --cwd packages/web-landing dev        # fetches the CRS, copies the artifacts, the slot table and layouts, then Vite
bun run --cwd packages/web-landing build      # the production bundle (dist/, with _headers)
bun run --cwd packages/web-landing og-card    # renders public/og.html to public/og.png (committed)
```

## Tests

```
bun run --cwd packages/web-landing test:components                   # Vitest: the sections in order, the demo run
                                                                     # with a fake Worker, launch mode
bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e     # Playwright on an isolated network: nothing of
                                                                     # the prover before the click, a real proof with
                                                                     # its step times, no request elsewhere, the phone
```
