# Phase 1 — The primitives and the header

Arc 1 (`worktree-yacana-polish`, stacks on main). Started 2026-09-15.

## What was built

- `packages/ui`: `Header` + `Brand` + `AccountChip` + `Gear` (`header.tsx`), the five glyphs (`icons.tsx`, the
  canvas' paths on the 24-grid, 1.6 stroke), `StatusChip` (`.st`: dot + mono label; `done` carries ✓), `ClaimChip`
  (the claim's step and one clock; `stopping` → "stopping · claim finishing · N s"), `AmountField` (the number,
  the unit and MAX on one baseline, the line under it once), `Badge` `net` (the neutral testnet tag), `Dialog`
  `size="tx"` (440 px), `Stepper` on the canvas' geometry (18 px ring, ✓ when done, lit while active, the
  connector; pending titles `ink-2`, details `ink-3`; `progress` draws the determinate bar), `Trail` ✓ on done
  stations (dim, no light), `HoldButton` `waitingLabel` (dimmed, disabled, arms when gone) and `reveal` (shown
  under the button once a hold was let go of early), `StatusPill` `stopping`.
- The miner's shell: `Header` with Mine · Wallet · Stats ↗ · Verify ↗ (`lib/tabs.ts`), `testnet` neutral, the
  pill, the account chip → Wallet (→ Settings on the old origin), the gear (`aria-label="Settings"`, so the
  suites' `getByRole('link', { name: 'Settings' })` still finds it). The stats app: Stats · Bridge · Verify ·
  Mine ↗. The landing's bar: `Brand` with the version, its sections nav, Stats and Mine, `testnet` neutral.

## Decisions taken while building

- **The stepper follows the canvas, not the brief's one-liner.** Brief §4.3 says "done: ink-2 + ok dot"; the
  canvas draws an 18 px ring with a ✓ and a connector line (`lib.py` `.step`). The boards are what the owner
  approved by eye; the ring is what the pages get. `data-state`, `aria-current="step"` and the sr-only state
  text are unchanged, so every existing spec still reads it.
- **A phone-safe header.** The canvas has no phone header (the miner is desktop only), but the stats app is read
  at 390 px and the visual gate shoots it there. The previous header already overflowed at that width (the old
  `bridge-390.png` baseline is 474 px wide for a 390 px viewport); with four iconed tabs it overflowed more. Under
  `md` the tabs drop to a second row that scrolls sideways; the brand and the right side share the first.
- **The reveal is the primitive's.** `HoldButton` renders `reveal` itself once a hold was abandoned (an early
  release, a drag off, a blur while holding), in a column wrapper only when `reveal` is given, so the sign-out
  dialog's row layout is untouched until P2 rewires it.
- **`AccountChip`'s avatar** is a conic gradient from tokens (`color-mix` for the dark stop): `tokens.test.ts`
  refuses literal colours in components, rightly.

## Gate — green 2026-09-15

- Fast layers: `bun run lint` clean (580 files); `typecheck` in ui, web-miner, web-stats, web-landing clean;
  `bun test` 418 pass · 39 skip · 0 fail (98 files, 93.8 s); `test:components` ui 66/66, web-miner 95/95,
  web-stats 84/84, web-landing 14/14.
- Replay: the first recording attempt failed — this worktree had no `packages/contracts/target/` (gitignored;
  the record's deploy reads the miner artifact from there). Compiled with `~/.aztec/versions/5.2.0/bin` on PATH
  (`bun run contracts:compile`), re-recorded on a fresh isolated network (12 answers), then
  `bun run --cwd packages/web-miner test:replay`: 4 passed (41.5 s) — the dialog geometry at 720 px, the
  malformed RPC, the old Presto's update row, the public epoch poll from the recording and nothing else.
- Visual: `test:visual --update-snapshots` in `mcr.microsoft.com/playwright:v1.62.1-noble`, the eight baselines
  reviewed by eye (the desktop header right at 1280/1440; at 390 the first cut overflowed to 654 px — the old
  baseline already overflowed to 474 — fixed by the phone layout, now 390 px wide with the brand, the right side
  and the tabs on their own rows), then `test:visual`: 8 passed (8.0 s).
