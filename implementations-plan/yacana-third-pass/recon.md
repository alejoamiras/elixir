# Recon — yacana-third-pass (Phase 0.4)

Read-only sweep over the worktree at `origin/main` `f7e2ad4` (one Explore agent over thirteen capabilities, plus the
six-ask map taken before the canvas was drawn). Every absence carries its search trail.

## Reuse map

| Capability needed | Existing code | Verdict |
|---|---|---|
| Skeleton / shimmer block | none; `animate-pulse` only on the status pill's dot and a proof line's flash | **build new** — one `Skeleton` primitive in `packages/ui` (`motion-reduce:animate-none`), nothing to adapt |
| Number tween from "no value" | `useTweenedNumber` (`packages/ui/src/hooks/use-tweened-number.ts`), `Tweened` + `unsettledAtom` (web-stats) | **adapt** — the hook seeds from the first value; a `null` start must show the skeleton and then glide from 0 on the first number |
| Modal | `Dialog`/`DialogContent` (`packages/ui/src/components/dialog.tsx`; Radix; overlay `bg-ground/70 backdrop-blur-[2px]`) | **reuse-as-is** — the sign-in modal is a `Dialog` at `sm:max-w-[480px]` like `SignOutDialog` |
| Progress bar | `Progress` (`packages/ui/src/components/progress.tsx`, Radix, `h-1`, unused today) | **reuse-as-is** (percentage in) |
| Step list | `Stepper`/`Step` (`stepper.tsx`: pending · active · done · failed, `ms`, `detail`) | **reuse-as-is** |
| Boot phases + strings | `boot.ts` preflight rows `isolation · crs · node · deployment` → `key` → `opening` (a single string: "opening the wallet", "registering your account …", "registering the deployment", "starting the prover") → `ready`; `state.ts` `Boot` union; `KeyScreen.tsx` renders them | **adapt** — the opening phase becomes `Step[]` with a bytes field; the preflight's `crs` row moves out of the gate |
| Proving-key byte progress | `preloadPinnedCrs` (`pinned-crs.ts:64-70`) awaits whole buffers; no byte counter | **build new** — a streamed reader reporting `loaded/total` (the pinned hash check unchanged) |
| Error boundary | none (no `componentDidCatch`, no `react-error-boundary` in any package.json) | **build new** — one class component in `packages/ui`, rendering an `Alert variant="bad"` |
| Connection load/save | `packages/site/src/browser/connection.ts` (`yacana.connection`, nodeUrl only; query overrides on localhost + e2e) | **reuse-as-is** — the one place all three apps read the node |
| CSP / `_headers` | `headers.ts` (`connect-src 'self' data: <nodeOrigins>`), `assemble.ts` renders it, `config.ts` `allowedNodeOrigins` + `assertProductionConfig` | **adapt** — `https:` replaces the origin list in production; the allowlist and `disallowedNodeUrl` go |
| Node health probe | `boot.ts:96-107` (`getChainId`, `getNodeInfo`, `getBlockNumber`), `reader.ts` `assertDeployment` + `expectedFromStrings` | **adapt** — extracted to a `probeNode(url)` the boot, the Node tile's Check and the health line share |
| Node stale / unreachable | web-stats `statusAtom` `unreachable`, web-landing `markUnreachable`, miner `controller.ts` `offline` notice ("node unreachable for a minute") | **adapt** — one `nodeHealth` state (ok · throttled · silent · stalled) fed by a fetch wrapper; the three apps render it on the shared banner |
| 429 handling | none (`429`, `Too Many`, `rate.?limit` — zero hits in `src` TS/TSX of the five packages) | **build new** — the fetch wrapper reads the status |
| Banner | `Alert` (`alert.tsx`: neutral · uv · warn · bad), `previewNotice` rendered in the three `App.tsx` under the header, `data-testid="preview-banner"` | **reuse-as-is** — the node banner sits in the same slot |
| Stats read order | `chain.ts` `readChain`: open epoch + block → the 48-epoch window (caught into `historyError`) → supply + genesis + lottery; `statusAtom` steps; `WINDOW = 48`; `readOlder` prepends 48 | **adapt** — `readChain` publishes two beats; supply and genesis move to the first |
| Stats null render | `routes/Stats.tsx:32` `if (!chain) return null` | **adapt** — the skeleton page renders instead |
| Observatory / charts / table | `Observatory.tsx` (six tiles, all chain-fed), `ChartRows.tsx` (200 / 110 px), `Table.tsx` (`load-older`), `charts/specs.ts` | **adapt** — each takes `rows: null` and draws its skeleton |
| Strip | `Strip.tsx` (`flexGrow` = duration/6 clamped [6, 400], ← → step, `onOlder`), `routes.ts` `?epoch=` | **adapt** — a windowed `rows` slice, a `Map` under it, `?from=` |
| Money table | `Money.tsx` `CELL = 'border-b border-line py-2 pr-2.5'`; the section's rule is `Section.tsx`'s `border-t` | **adapt** — `last:border-b-0` |
| Senders card | `Wallet.tsx` `Senders` (117–149); `session.ts:229-232` `addSender → registerSender`; asserted by `e2e/withdraw.e2e.ts:22-34` (`sender`, `add-sender`) | **adapt** — the row moves to Settings → Advanced (same testids), the wallet card goes |
| ScoreLoop | `score-loop.tsx` (calm: `drawCalmLines` labels at `left − 8`; `layout()` pins `left = 28` when `geometry` is set; short strips draw dots), `score-loop-model.ts` + its test | **adapt** — the margin from `measureText`, ticks at every height, the baseline label yields |
| Pop-out | `LoopTile.tsx` `PipView` (`height 48`, `geometry {pad 4, fontPx 10}`), `pip.ts` `PIP_SIZE 360×190`; `miner.e2e.ts:254` | **reuse-as-is** (only the loop changes) |
| E2E sign-in | `e2e/helpers.ts` `virtualAuthenticator` (CDP, auto-presence), `passKeyScreen` (`create-passkey`, `open-key`) | **adapt** — the helper opens the modal first |
| Visual gate | web-stats only: `visual.e2e.ts` on `visual-rpc.json`, four widths, zero tolerance | **reuse-as-is** — the baselines regenerate once (skeleton never in frame: the recording answers at once) |
| Settings persistence | `settings.ts` (`yacana.settings`, validated keys) | **reuse-as-is** |
| Public epoch view (no wallet) | miner-core `reader.ts` `readOpenEpochNumber` + `readEpochs({withSeed})` through `slots.ts` (`/slots/<chunk>.json`, `/layouts.json`) — the stats page's path | **reuse-as-is** — the miner reads its signed-out epoch this way; the controller keeps its simulate path once signed in |

## Facts the design rests on (from the sweep)

- The miner's epoch and rules come through the wallet (`epoch.ts` `readOpenEpoch` simulates `open_epoch`,
  `epoch_params`, `claims_in`; `readRules` likewise) — nothing chain-side is read before an account exists except the
  preflight's node probe and `assertDeployment`. `PARAMS` (generated) carries `N`, `EXPECTED_EPOCH_SECONDS`, `T_MAX`.
- `readEpochs` is three sequential `getPublicStorageAt` per epoch (target, opened_at, claims; a fourth for the
  seed), eight in flight, 10 s each; `maxEpochs` 96 per call. A thousand epochs is three thousand calls.
- `openWallet(node, chainId)` and every later holder take the node client object once; the client is the SDK's
  JSON-RPC proxy from `createAztecNodeClient(url)`; `boundNodeRequests(url, ms)` binds a per-request deadline by URL.
- The Dialog overlay already blurs (2 px) and dims (`ground/70`); Radix traps focus and handles Escape.
- The three apps render the preview notice in the same slot with the same testid; nothing else uses that slot.
- `test:visual` replays a recording that answers instantly, so the skeleton never enters a baseline frame; the
  baselines still change if any settled pixel moves (the strip's map, the controls row).
- No test asserts the opening-phase strings, the Network tile's copy or `boot-step`; `withdraw.e2e.ts` asserts the
  senders flow by testid; `miner.e2e.ts` opens the pop-out.

## Collision / dedup risks

- `Progress` exists and is unused: the modal's bar reuses it (percent in), no hand-rolled div.
- Two "unreachable" shapes coexist (declarative atoms in stats/landing, an imperative `offline` flag + notice in the
  miner's controller): the node-health state extends the declarative shape and the controller's `offline` pause
  reads it instead of keeping its own clock.
- `session.ts` lives at `packages/web-miner/src/session.ts` (no `wallet/session.ts`).
- The opening phase's `Boot` shape changes; only `KeyScreen.tsx` reads it today.
- An error boundary must not swallow the explicit `boot.phase === 'error'` / `status.phase === 'error'` paths.
- The CSS the canvas prototyped (`.sk`, `.veil`, `.dull`) is drawn from `packages/ui` tokens; the implementation uses
  Tailwind utilities and the tokens, never a copied stylesheet.
