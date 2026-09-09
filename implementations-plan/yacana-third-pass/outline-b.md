# Competing outline B — the same picks, the least new machinery

The same eight outcomes as `plan.md`, reached with as few new mechanisms as possible: no switchable client, no health
store, no staged reader, no background fill. Cheaper to build and to review; it gives up three promises the canvas
makes and is listed here so the audits can weigh them.

## What differs

1. **Node switch = save and reload.** The Node tile keeps Check (the probe) but "Use this node" saves the URL and
   reloads the page, as the Network tile does today. The wallet reopens on load: a words account that "stays open on
   this device" comes back without a prompt, a passkey account asks for a touch; mining restarts from idle. The tile's
   copy says so ("Reloads the page; mining restarts."). No `switchableNode`, no `Proxy` risk (I1 disappears).
2. **The banner from the states that exist.** The stats and the landing already hold `unreachable`; the miner's
   controller already pauses on a silent node. B adds one check to each poll (`response.status === 429` → the same
   unreachable / offline state with a `throttled` flag and the `Retry-After` delay) and renders the banner from those
   three states; no shared store, no fetch wrapper beyond the deadline that exists. Cost: three implementations of the
   429 rule, one per app, and the miner's controller keeps its own clock.
3. **One beat, not two.** The stats page renders its skeleton at 300 ms and fills everything when `readChain`
   returns, as it is; the two chain-free tiles render at once. No `fixedAtom` / `historyAtom` split, no staged reader,
   no `Tweened` change (the values glide from 0 as they do after a poll). Cost: the header pill, minted and the epoch
   number wait for the 48-epoch window (a few seconds on a slow node) instead of a second.
4. **The map from what has been paged, plus the cache.** The map draws the epochs held: the newest 48 at boot, plus
   whatever ‹ older pages in, plus the cache from earlier visits. No background fill: the first visit's map is 48 bars
   wide over a rail that spans the whole history (the empty part drawn as a hairline with "‹ older to read more"). The
   cache still makes later visits whole. Cost: the "map of everything" is earned by paging, not given.
5. **The CRS stays in the gate, but behind the modal.** The preflight runs as it does (isolation → CRS → node →
   deployment) while the signed-out cockpit is painted from the public read; the modal's primary button is disabled
   until the preflight passes, its label "preparing… 8 MB of 20" from a streamed loader (the only new mechanic B keeps
   from A, because the bytes are the whole point of the wait). No `startCrs` task, no `crsAtom`; the opening steps are
   passkey · wallet · notes · ready.
6. **Everything else as plan.md**: the dull cockpit and the sign-in dialog, Opening A's bar and steps, the public
   epoch read before sign-in, the strip's window and `?from=`, the money table, the pop-out's margin and ticks, the
   error boundaries, the senders row.

## What it costs against the canvas

- The Node tile's "Applies at once; mining carries on" becomes "Reloads the page; mining restarts." (a passkey touch
  on every switch).
- The first beat of the stats page is gone; the whole page fills at once after the window lands.
- The map's first visit is partial.

## Arcs and gates

The same three arcs and the same gates, minus: `node.test.ts`'s proxy cases, `node-health.test.ts` (replaced by one
429 case per app's poll test), the staged-read case in `chain.test.ts`, the `fillHistory` cases. The miner E2E's node
switch becomes a save-and-reload case (the page comes back signed in for a words account).

## When B wins

If P1.1's E2E shows the embedded wallet holds the client in a way the proxy cannot switch, plan.md's own fallback for
the node switch is B's item 1 — take it then, not now. If the codex or fable audit finds the health store or the
staged reader to be more surface than the two promises are worth, B's items 2 and 3 are the cut.
