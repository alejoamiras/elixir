# Yacana bridge + migration — take two: the guided path

## What take one got wrong (owner's feedback, 2026-09-11)
Six avenues on equal footing (send, withdraw to Ethereum, deposit, commit-and-wait, commit-and-relay, force the relay).
Migration read as a menu, not a path. The old app kept a whole cockpit. "Headroom", "pause budget", the versions table
were jargon. Stats must show the canonical version only; the bridge gets its own page. Mining on V5 must be blocked in
the UI once V6 is live. Say plainly what is lost and when.

## Facts that shape it
- V6's chain produces blocks only after the flip: validators move at `Registry.addRollup`, staking into a
  non-canonical rollup is refused (`Staking__NotCanonical`). So Yacana's V6 contracts deploy hours AFTER the flip,
  and V5 is already retired (its mining stopped by the portal's retire message) by then.
- V5 keeps proving after the flip only while unmoved validators stay; without rewards that is hours to days,
  unknown in advance. A burn on V5 after the flip is a gamble; committing before the flip is the safe path.
- A committed balance is burned on V5, proven to Ethereum with its epoch, held there, forwarded into V6's Inbox
  by the relayer once Yacana registers V6, and minted on V6 by a private claim from the same account (the
  secret is derived from the passkey/words).

## Principles
1. One primary action per moment; everything else one level down.
2. A user acts at most twice: commit (before the flip) and sign in on V6. Arrival is automatic (auto-claim).
3. Exceptions surface only when they happen (relayer quiet > 1 h, sponsor down, RPC silent, never proven,
   paused), as one line and one link → one dialog.
4. The everyday bridge (to / from Ethereum) is a wallet feature and never part of the migration message.
5. Every migration screen says what is lost and when: "Anything still on V5 when it goes quiet is lost. V5 goes
   quiet days after the upgrade, without notice."
6. The observatory is the canonical version only; `/stats/bridge` is its own page; `/faq` explains with a diagram.

## The verb
"Commit to V6" (owner's word); the state phrase "committed · sent ahead to V6". Alternative: "Send ahead to V6".

## Moments, each with its one primary action
- M0 everyday. Wallet: Send (primary) · To Ethereum (secondary) · "Deposit from Ethereum" (a link). The journal
  tile appears only while something is crossing; a finished crossing fades after a week.
- M1 announced (about 7 days before the flip). A migration card on top of Mine and Wallet: "Aztec V6 arrives
  around Sep 18. Commit your balance now; it arrives on V6 by itself." [Commit to V6] · "what happens →" (FAQ).
  Mining continues. Stats and the landing show a one-line announcement.
- M1' committed. The card is a status: "48 tYACA committed · waiting for V6 (~Sep 18) · nothing to do". Rewards
  mined since: "8 mined since — commit those too".
- M2 flip detected (the V5 build is still at the apex, for hours). Mining blocked in the UI. Card: "Aztec V6 is
  live. Yacana's V6 app arrives here within hours. Commit what is left while V5 still proves — days at most.
  Anything left when V5 goes quiet is lost."
- M3 the V6 build at the apex. Sign in → the arrival card: "Bringing your V5 balance over · 40 tYACA landed ·
  8 on its way" — auto-claim, a private transaction per commitment, ~20 s each, fee sponsored. If the same
  origin remembers a V5 balance this account still had: "You still had 8 tYACA on V5 → move it from
  v5.yacana.network".
- M3' the old app (v5.yacana.network). A single-purpose page: sign in (same passkey) → "8 tYACA still on V5"
  [Commit to V6] · "or take it to Ethereum" → committed → "it arrives at yacana.network by itself". No cockpit,
  no wallet page, no settings.
- M4 V5 quiet. The old app's dead state; the arrival card on V6 marks a never-proven commitment as lost.

## Everyday bridge (unchanged mechanism, simpler surface)
- To Ethereum: amount + address → review (public there: amount and address; ~20 s to prove, usually under an
  hour to Ethereum) → done. The journal card shows progress; minted turns it green.
- From Ethereum: connect a wallet → amount → approve, deposit → it arrives by itself (auto-claim on sign-in).

## Stats
- `/stats`: unchanged, plus the one-line announcement during a window.
- `/stats/bridge`: the phases timeline first (the owner loves it), where the coins are (chart), one card per
  version (a supply bar: here · on Ethereum · in transit · moved on; a sentence; when its exits close), the
  portal in plain words ("exit limit: exits from V5 are capped at three times what mining could have produced;
  128 of 1,300 tYACA used today; exits over it wait, they are not refused" · "pause: not paused; the operators
  may pause exits and deposits for up to 30 days at a time, 60 days in total per version"), the record.
- `/faq`: mining, the bridge, the migration (a six-panel diagram), what is public, what can go wrong.

## Open questions
1. The verb: Commit vs Send ahead.
2. Auto-claim on sign-in vs a Claim button.
3. A pre-authorisation "commit everything automatically when V6 goes live" (works only with the tab open and the
   account kept open on the device): worth its flow?
4. Default amount = the whole balance, with "some of it" as a link?
5. Should the old app keep "take it to Ethereum", or only Commit?
6. Is there a moment where the user cannot tell which app they are in?
