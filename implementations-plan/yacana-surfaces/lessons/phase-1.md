# Lessons — arc 1 (ui)

## P1.1 Scaffold, tokens, fonts, primitives, status (2026-09-05)

**Result:** ✓. `packages/ui` (`@yacana/ui`): `theme.css` (palette on `:root` / `.light` as plain variables, `@theme inline`
maps them to Tailwind names and to shadcn's semantic names so the primitives render on the same palette; the binder's
type scale; two `@utility` classes `eyebrow` / `label-mono`), self-hosted Hanken Grotesk + JetBrains Mono (fontsource
variable 5.3.0, exact), primitives (button, input/textarea, label, switch, segmented, sheet, dialog, alert, badge,
progress, toaster, tile/kv-row), StatusPill (5 px square light; only `mining` pulses, `motion-reduce:animate-none`),
Kpi, Mark + `markSvg`/`faviconDataUrl` (SVG data URL, testable in jsdom; a canvas is not), ThemeProvider (dark default,
`yacana.theme`, class + `data-theme` on `<html>`; the old provider's hidden `d` hotkey and `next-themes` are gone),
`tokens.ts` (the dark palette as literals for the favicon and canvas fallbacks, pinned equal to `theme.css` by a test).

- **Tile replaces Card.** The plan drops `card.tsx`; the binder's panel is the `.tile` (raised ground, hairline, mono
  label). `Tile`/`TileHeader`/`KvRow` are the arc 2 building blocks and let P1.3 migrate the current cards 1:1.
- **RTL does not auto-clean without vitest globals**; `tests/setup.ts` registers `afterEach(cleanup)` or `getByText`
  finds duplicates across tests. `import.meta.url` under vitest must go through `fileURLToPath`, not `new URL('.', …)`.
- Biome's `noImportantStyles` warns on the usual reduced-motion `!important` block; dropped in favour of per-component
  `motion-reduce:` variants (the plan's rule anyway: still frames, no pulse, counters snap).
- Root `tsconfig.json` now also excludes `packages/ui/src` (JSX, own `tsc`); `test:components` at the root is the
  `--filter './packages/*'` glob (packages without the script are skipped). `theme.css` compiles under
  `@tailwindcss/node` (checked once by hand; the P1.3 build is the standing check).

Gate: `bun run lint` ✓ (0 warnings) · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · ui `typecheck` ✓ · `test:components` web-miner 12 + ui 15 ✓ · `bun test` 52 pass ✓.

## P1.2 Signature components (2026-09-05)

**Result:** ✓. `score-loop-model.ts` (pure: log axis 1–1000, 420 ms ease-out rise, 900 ms flash, span-trimmed sample
buffer), `ScoreLoop` (canvas; reads `--uv`/`--ink`… from the computed style with `tokens.ts` as the jsdom fallback; rAF only
while visible in a foreground tab; a still frame per data change under reduced motion), `ProofLedger`/`ProofLine`
(★ ✓ ✗ ── grammar, 120 ms entry, 200-line window), `Stepper`, `Preflight` (evidence rows, failure error + action),
`EpochRail` (segments with the key's own claims brighter, expected tick at 1/1.25 of the track, kv rows, "Close the epoch"
when the hatch ≤ 0), `PowerSlider` (native range; eco/balanced/max = ⌈(cores−1)/4⌉ / ⌈(cores−1)/2⌉ / cores−1, clamp),
`Marks`. Hooks `useReducedMotion` / `useDocumentHidden` on `useSyncExternalStore`.

- Biome's cognitive-complexity cap (15) bit the ledger line's nested ternaries; split into a tone map plus two small
  subcomponents rather than suppressing.
- `toHaveTextContent` sees no spaces between flex-gapped spans; assert with regexes, not the visual string.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · ui `typecheck` ✓ · `test:components` ui 25 + web-miner 12 ✓ · `bun test` 55 pass ✓.

## P1.3 web-miner on ui (2026-09-05)

**Result:** ✓, no redesign. `index.css` is two lines (`@import "../../ui/src/theme.css"; @source "../../ui/src";`);
the five cards render as `Tile`/`TileHeader` (the `aside` slot takes what sat right of the title), the phase badge is
the `StatusPill`, the boot alert is `variant="bad"`; `components/ui/*`, `theme-provider.tsx`, `lib/utils.ts` and
`components.json` deleted; `ThemeProvider` mounted in `main.tsx` (the old one never was). Dependencies dropped from
web-miner: geist, next-themes, shadcn, cva, clsx, tailwind-merge, radix-ui, lucide-react, sonner, tw-animate-css,
@tanstack/react-query (unused) — lockfile −500 lines. Vitest include is now `*.vitest.tsx` + `*.test.ts`.
`web-miner.yml` and `contracts.yml` filters add `packages/ui/**`; CLAUDE.md gains the `packages/ui` row.

- The production build carries both variable fonts as woff2 subsets (self-hosted; `font-src 'self'` holds) and the ui
  utilities (`label-mono`, `bg-raised`, `fill-uv`) reach the CSS through `@source`. Test ids and copy unchanged, so the
  eight E2E specs pass as they were.

Gate: `bun run lint` ✓ · `lint:actions` ✓ · `lint:shell` ✓ · `typecheck` ✓ · ui + web-miner `typecheck` ✓ · `test:components` 25 + 12 ✓ · `bun test` 55 ✓ · E(web-miner) 8 passed (3.6 min) ✓.

## Arc 1 codex loop (2026-09-05)

**Round 1** — session `01a0729b-1a84-7b60-996a-5d00ced8ba67` (gpt-6-astra, xhigh, read-only; files in `~/.cache/tmp/codex-6R8bsYal`).
Verdict: "Changes needed: material CI and accessibility issues; I found no new exploitable HTML-injection or secret-handling
path." Eight findings, all verified and applied:
1. `dorny/paths-filter` documents `pull-requests: read` for PR-triggered runs. Empirically the PR files API answered with
   `contents: read` alone on this (public) repo — the previous runs' logs show only `Contents: read`, `Metadata: read` — but the
   `changes` job of every filtered workflow now grants both read scopes; `miner-core.yml` has no filter.
2. Reduced motion was only honoured by the pill: sheet/dialog overlays and content, switch, progress, the mark's dot and the
   toaster's spinner now carry `motion-reduce:` variants.
3. Step / preflight / ledger states were colour + `data-*` only: `sr-only` state text, `aria-current="step"` on the active
   step, "win" read out for ★ lines; assertions added.
4. Contrast: `label-mono` (11 px) and the timestamps/evidence/hash labels sat on `ink-3`/`ink-4` (3.5:1 and 1.9:1). Readable
   small text is now `ink-2`; `ink-3`/`ink-4` remain for decoration. A deliberate departure from the binder's 40 % labels.
5. The reduced-motion still frame ignored theme and size changes (codex probed it: no redraw on `.light`, a stale 400 px
   bitmap after a resize). A `ResizeObserver` on the canvas and a `MutationObserver` on `<html class>` redraw it; test added.
6. Power labels with equal thread counts (2–3 cores) overlapped; they merge ("eco / balanced · 1"); test added.
7. Sonner never read `--font-family`; the wrapper sets `fontFamily` and the description colour through the ink token.
8. Comments: the model's "fading margin" claim was false (it keeps exactly `spanMs`) and the mark's "shared geometry" is
   duplicated (now says so); twelve narrating one-liners deleted.

**Round 2** (resumed) — "Changes still needed: two CSS fixes remain ineffective, and the merged slider labels expose an
edge-positioning issue." Applied: (1) Tailwind's generated `data-[state]` animation selectors outrank
`motion-reduce:animate-none`, so the dialog/sheet enter/exit classes are `motion-safe:data-[state=…]:animate-…` instead
(codex checked the compiled media query); (2) `[&]:text-ink-2` lands in the utilities layer under Sonner's unlayered rules
— `text-ink-2!` (important) wins; (3) merged labels at 0 % / 100 % are edge-aligned, only intermediate ones centred;
(4) the `Kpi` paragraph codex had flagged was still there — deleted. Codex re-probed the canvas: theme/resize redraws,
no hidden drawing, observers disconnected on unmount.

**Round 3** (resumed) — converged. Verbatim: "The fix diff resolves the remaining findings without introducing regressions.
**No new material findings.**" Codex verified the production CSS gates the dialog/sheet animations on `no-preference`, the
important toaster override, and the rendered slider labels for 1, 2, 3, 4 and 12 cores.
