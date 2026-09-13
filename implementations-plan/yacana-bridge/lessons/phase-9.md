# Phase 9 — stats, the announcement lines, the FAQ

## What landed

- `packages/bridge/src/portal-reader.ts`: the viem-only portal reader moved out of the miner's wagmi module (which
  re-exports it), with the reads the stats page needs — `flows(version)` (exited, inbound, cap, headroom, the pause,
  the deadline), `registered()`, `policy()`, `operators()`, `forwarders()` (every `ForwarderSet`, the last word per
  address).
- `packages/web-stats`: route `bridge` (`/stats/bridge`, the nav's third word, the assembler's redirect),
  `bridge-beat.ts` (the one read and the sentences — the exit limit, the pause, a version's line, the phases as a
  timeline), `bridge.ts` (the poll over the Ethereum RPC through the fetch guard), `features/Bridge.tsx` (the
  phases tile, a card per registered version, the portal in plain words with its keys on Etherscan, the no-bridge
  state), `features/Announcement.tsx`, `routes/Bridge.tsx`, Verify's Ethereum tile, `explorer.ts` with Etherscan;
  `bridge-beat.test.ts`, `features/bridge.vitest.tsx`; the e2e run deploys the bridge on the run's anvil through
  the shared `packages/deploy/src/bridge/run.ts` (the miner's setup uses it too) and the spec reads the live card.
- `packages/web-landing`: `routes/Faq.tsx` under the landing's header (six panels, the questions, the miner and
  the bridge page one tap away), `copy.faq` and `copy.announcement`, the `Announcement` in the shell, the footer's
  FAQ link, `isFaqPath`; the e2e's second build announces a migration; `site.e2e.ts` covers `/faq` and
  `/stats/bridge` under the one policy.
- `packages/ui`: `ChipLink` carries `data-slot="chip-link"`.

## Gate

`bun run test:components` ✓ (ui 49, landing 13, miner 84, stats 75 — the bridge beat, the page and the
announcement among them) · `bun run --cwd packages/web-stats test:visual` 4/4 ✓ (baselines refreshed for the
nav's third word, nothing else moved) · `bun run e2e:agent -- bun run --cwd packages/web-stats test:e2e` 6/6 ✓ (the
bridge page on a live portal: this version registered and live, the limit and pause sentences, four phases,
five keys, Verify's Ethereum tile) · `bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e` 4/4 ✓
(`/faq` with its six panels and the questions; the announced build's one line) · `bun run e2e:agent -- bun run
site:e2e` 3/3 ✓ (`/faq` and `/stats/bridge` under the one policy) · the miner's `bridge` shard 1/1 ✓ on the
shared run helper · lint, typecheck, `bun test` (398) ✓.

## Lessons

- A type-only import of a `.tsx` module from a `.ts` file the root `tsc -p tsconfig.json` includes fails with
  TS6142 ("--jsx is not set") — the root typecheck covers `packages/web-stats/src`. The stepper's row shape is
  declared where the phases are computed, with plain-text labels, rather than imported from the UI package.
- The explorer link builders (`links`, `l1Links`) read their base URL when the module loads; a Vitest `stubEnv`
  in `beforeEach` comes too late, so a spec asserts the chips by label, not by href. `ChipLink` puts its test id
  on the anchor only when it has a link.
- The stats visual gate's baselines are the whole page: a third word in the header's nav changes all four.
