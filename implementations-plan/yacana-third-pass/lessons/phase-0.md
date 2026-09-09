# Phase 0 — the design round, the recon, the audits

## The design round (2026-09-08)

- The owner's seven asks arrived as a list; the "0" crash was the only one without a repro. A static hunt over every
  place a zero could reach (the difficulty formula, the calculator, the power slider, the retarget mirror, the React
  `&&` renders) found no line that throws; the owner then said "on the Miner's graph, possibly the pop-out too", which
  points at the loop's labels: the bar's label and the baseline's "1" share the left margin, and the cockpit passes
  `difficulty 1` before the epoch is read. Lesson: when a report names a symptom and not a place, ask for the place
  before hunting; the second message cost less than the hunt.
- The "pop-up" of the owner's follow-up was the Document Picture-in-Picture window (`PipView`), not a modal: it is
  the one caller of `ScoreLoop` with `geometry`, whose `layout()` pins the left margin at 28 px and whose short
  branch draws dots. The live testnet's bar had moved to two digits (50–56), which is when the margin became visible.
- Canvas mechanics that held: the generators in the scratchpad (`third.py`, `third_b.py`, `build3.py`), one
  `seed-canvas.mjs` call over the `out3/` directory, the Artifact republished to the same URL with the picks folded
  into the start board. Two rounds; eighteen artboards.
- Picks: stats skeleton (two beats); mine dull cockpit + modal, opening A; node free https URL, throttled state on a
  banner; strip A; senders card out of the wallet; money table's last rule gone; the pop-out on the cockpit's drawing.

## Recon (Phase 0.4)

One Explore agent over thirteen capabilities (report in `recon.md`). The findings that shaped the plan: the miner
reads its epoch only through the wallet; the CRS download sits in the preflight gate with no byte progress; the
stats route renders nothing until every read is in; `readEpochs` is three sequential storage reads per epoch;
`Progress` exists unused; no error boundary, no `measureText`, no 429 handling anywhere.

## Audits

- **Codex round 1** (Astra high, session `01a081ee-5a5a-7ef2-ab1b-2339b4f8cb38`): `reject` — the CSP argument was
  wrong on the image channel and understated the loss; `pinned-crs` relied on the CSP to fail closed; the live node
  switch under the wallet is unproven (the SDK caches `NodeInfo`, the PXE keeps anchors and rollback state); health
  measured transport, not chain freshness; Cancel had no owner; the `e2e` preview build needs local origins the new
  CSP would block; plus the cache's caps, `Retry-After` parsing, the boundary's message, the money selector
  (`last:` on a cell is the row's last cell), the skeleton timer's fast-first/slow-second case, the map's coordinates,
  the visual recording. All adopted; the live switch dropped for save-and-reload.
- **Fable round 1** (Plan agent): `conditional approve`, nine conditions. New beyond codex: a node switch (even by
  reload) can prune or poison the PXE's per-rollup view — rebuild it on the first boot after a node change; the
  guard should be the throttle gate (a synthetic 429 covers the PXE's own reads) and 429s mostly arrive as opaque
  network errors; the SDK client retries three times by default; `webrtc 'block'`; the cache keyed by node origin;
  the fill should stop for the visit on a throttle; the dialog must keep the key screens' four links (two E2E specs
  use them); `frame()` calls `layout()` before the font is set; `ui` must not import `site`'s types; `Progress` has
  no indeterminate mode; the Biome splits named. All adopted. Where the two disagreed (live switch + rebuild vs
  reload) the plan takes the reload with the rebuild.
- Lesson: both audits found the same two blind spots in the draft — controls that lived in the CSP (the CRS
  fail-closed property, the E2E's local origins) and state that lives below the app (the PXE's view, the SDK's
  retries). Next time recon reads `node_modules/@aztec/{pxe,wallet-sdk,foundation}` for how the client is held
  before a plan touches the node.
