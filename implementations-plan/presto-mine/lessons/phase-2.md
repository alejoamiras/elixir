# Phase 2 — the probe, the billboard, the fix-it row, the indicator

Started 2026-09-09 after P1 (`8696454`).

## Log

- **The probe's home.** `probePresto()` runs at the preflight's pass (the cockpit is ready, no account yet) and is
  never awaited by the boot; `startSession` awaits the probe promise only when it is still pending (in practice it
  answered seconds earlier) so the controller is built with the endpoint when Presto is eligible. The user's Start
  goes through `Session.startMining()` (mining starts at once, Presto is re-asked in the background, a changed
  eligibility rebuilds the prover); the automatic resumes after a claim still call `controller.start()` and never
  probe. Retry is `Session.retryPresto()`: a forced probe, then `reconfigure(threads, endpoint, { force: true })`
  when eligible, `reconfigure(threads, null)` when the endpoint was set and is no longer — never a start, and
  nothing at all once the controller was disposed or replaced meanwhile.
- **`stateFromStatus` is imported from the banners' index, the element from `/register`.** The index carries the
  mapper and the strings (no registration, no network); the custom element's script and its registration load only
  when the billboard mounts. The Vitest spec mocks `/register` and asserts it was not loaded for `available`.
- **Two functions crossed Biome's 80-line budget** (`startSession` at 81, `Settings` at 91): a `prestoFor()` helper
  and a `PerformanceTile` / `AccountTile` extraction; behaviour unchanged.
- **jsdom fires `change` on a disabled range input** (React's `onChange` ran); a browser dispatches nothing on a
  disabled control. The slider spec asserts `disabled` and the dimmed block, not the absence of the callback.

## The real-browser check of Chrome's Local Network Access permission (homelab, 2026-09-09)

Setup: Playwright's Chromium **151.0.7922.34**, a page served on the homelab's LAN address (`192.168.1.15`, a
*private* address space) running the SDK's own `PrestoClient.checkStatus()` against `127.0.0.1` (loopback) — the hop
Chrome's LNA permission governs; first against a closed port, then against `presto-server 1.1.1` on a registry port.
Screenshots: `lna/lna-undecided.png`, `lna/lna-denied.png`, `lna/lna-granted.png`.

| permission state | closed port | headless Presto up |
|---|---|---|
| undecided (`navigator.permissions` → `prompt`) | `offline` in ~1 s | `available` in 34 ms — the fetch went through, no prompt |
| denied (CDP `Browser.setPermission local-network-access=denied` accepted, state stayed `prompt`) | `offline` | `available` |
| granted (`context.grantPermissions(['local-network-access'])`, state `granted`) | `offline` | `available` |

What this says:
- `navigator.permissions.query({ name: 'local-network-access' })` exists in this Chromium and reflects a grant, so the
  SDK's classification path (an *explicit* denial → `permission-blocked`) is live code, not a future one.
- **A denied state could not be produced in headless Chromium**: CDP accepts the descriptor but the queried state
  stays `prompt` (`localNetworkAccess` as a CDP name is refused outright), and Playwright has no `denyPermissions`.
  The `permission-blocked` row is therefore verified at the unit level (`presto.bun.test.ts`, `presto-banner.vitest.tsx`)
  and by the SDK's own tests, not in a real browser. A visitor who denies the prompt in a headed Chrome is the only
  way to see it live; the copy points them at the site's permission.
- **Undecided does not block in headless**: the loopback fetch simply ran. In a headed Chrome with LNA enforced the
  visitor sees the prompt at cockpit-ready (the owner's timing decision); until they answer, the SDK's probe waits on
  the fetch, and the page shows nothing Presto-related meanwhile (the probe is never awaited). The plan's inference
  ("undecided reads as a probe failure, not `permission-blocked`") holds for the closed-port case and is moot for
  the open one.
- The cross-origin page (`192.168.1.15`, not localhost) got Presto's **minimal** health (`schemes`, `api_version`,
  no versions — SEC-05 fingerprinting starvation), which the SDK reads as `available` on the legacy path; the
  e2e page on `localhost` gets the full report. Nothing in the miner depends on the difference: eligibility is
  `available && schemes ∋ ultra_honk`, which both satisfy.

## Renders

The 1280/1440 renders of the cockpit states need the page running against a node with a headless Presto beside it —
the e2e lane P3 builds. They move to P3's gate (recorded in `plan.md`); the component states are pinned by Vitest
here.
