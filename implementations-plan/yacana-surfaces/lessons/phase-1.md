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
