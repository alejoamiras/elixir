# Competing outline B — capability arcs instead of surface arcs

Same spec (the canvas, the owner's picks), same phases' content, a different cut of the work so the audit compares
plan-space, not one author's habit.

## Shape

Three stacked arcs by **capability**, each touching all three apps:

1. **Words and links** (`second-pass-links`): the explorer URL builder and `Chip href`, every render site linked in
   all three apps, the favicon injection and titles, the "key" → "account" rename, "T_MAX"/"roll()" → words, the
   docs line, the demo removal from the landing (it is deletion, not design). No layout change anywhere. Vitest and
   E2E assertions updated for copy only. Gate: every app's fast gates; the three E2E suites once (the copy changed
   under them).
2. **Layout** (`second-pass-layout`): the landing's hero tile, six frames and ledger; the stats' lead chart, small
   multiples, capped table, since-you-opened, ring, tweens, poll; the cockpit's calm loop, claim slot, balance card,
   pop-out. The stats baselines regenerate here. Gate: fast gates + the stats visual gate + the three E2E suites.
3. **Flows** (`second-pass-flows`): Send (radio cards, review, sent with the tx link), Sign out (hold, the dialog,
   the wallet page's one account), the sign-up copy, Settings' diagnostics move. Gate: fast gates + the miner E2E.

## Why it might be better

- Arc 1 is mechanical and low-risk; it lands first and stops the "key" vocabulary and the unlinked hashes from
  existing on `main` for two more weeks while the layouts are reviewed.
- Each arc's reviewer holds one idea (links, layout, flows) instead of one app's everything.
- The landing's demo removal, which deletes two dependencies and a worker, ships in the smallest possible PR.

## Why it might be worse

- Every arc touches every app, so every arc's boundary runs all three E2E suites (arc 1 and 2 both), roughly
  doubling the E2E minutes against surface arcs, and the stats screenshot baselines move twice (arc 1's wording,
  arc 2's layout) instead of once.
- A reviewer of arc 2 sees three unrelated layouts in one diff; the canvas comparison per surface is harder to do.
- The shared `packages/ui` additions (`HoldButton`, `RadioCards`) land in arc 3 with their only consumer, which is
  fine, but `useTweenedNumber` and `ScoreLoop calm` land in arc 2 while `Chip href` lands in arc 1: the design
  system changes in three places across the stack.
- `gh stack sync` after a fix on arc 1 rebases two arcs that each touch the same files (`Wallet.tsx` gets the rename in
  arc 1 and the account tile in arc 3), so conflicts are likelier than in the surface cut, where a file lives in one arc.

## Where it converges with A

Phases' content, gates, the Security and Assumptions sections, the Post-implementation loop and the Delivery
mechanics are identical; only the arc membership and the boundary E2E runs differ.
