# Fable review 2 — the brief v2 and the 79-board canvas (2026-09-15)

**Verdict: REVISE.** The copy is now true where v1 lied. Three sentences in the state table, the old origin's end state and the deadline's own successor are still wrong against the portal, and two boards promise what the code cannot tell.

## 1. Round-1 findings against v2

1. FIXED — "until at least Mar 17 (…)" everywhere; no bare date.
2. FIXED — no "safe" in any UI string; the chip has three states and §9.3.1 names its source.
3. FIXED — "usually", the "Forwarded into V6" step, the `not-registered` row.
4. PARTLY — every state has a sentence and a board, but the headroom-before-flip sentence is false (M1) and the hashless-proving fix mislabels a real burn (M4).
5. FIXED — routed through the Sign out dialog.
6. PARTLY — six notes drawn; two are one error the API cannot split, one promises a takeover that does not exist (M3).
7. FIXED — To / Paid by / Then, the switch, the rejection.
8. FIXED — WalletReasons, FromEthClosed, "longer than usual" (its clock is wrong: M2), "can't read the upgrade".
9. FIXED — pre-send "about 40 min after the send", the real time after.
10. PARTLY — probe at Start mining, three row states; the fallback row still draws one line for nine reasons (M5).
11. FIXED — unchecked, button disabled.
12. FIXED — WalletEmptyV6's hint.
13. PARTLY — the designer's verdict stands; the residual is the epoch tile's "claims 2 of 4" beside "wins" (L1).
14. FIXED — the phone sheet carries every row.
15. FIXED — no forward link; OldSettings has Account + Sign out.
16. FIXED — MineSent re-offers the wins mined since (its balance fixture is wrong: L7).
17. FIXED — ToEthFormPasted.
18. FIXED — details on their own line.
19. FIXED — the ring right of the step, the drop ending above the bar.
20. FIXED — neutral tag; the ended header has no button.
21. NOT FIXED, rejection accepted — Copy at creation and paste-off in the quiz answer different threats (a manager as the phrase's home vs proof the words were recorded); the finding overreached.
22. FIXED — Verify inside Stats on the phone, the badge, the full verbs.
23. FIXED — "Yacana forwards it"; the relayer defined once.

18 fixed · 4 partly · 1 not fixed (accepted) · 0 regressed.

## 2. New findings in v2

**high · §5.4 deadline sentence; Wallet, OldOrigin, AheadRows, HowItWorks.** "Until at least Mar 17" has no successor state. `deadline()` stays `max` until the version after next is observed, and when that observation is later than the floor the deadline *is* the observation: the `_sync` in the call that records V7 sets it to `block.timestamp`, `_requireOpen` passes in that block only, every later claim, forward or redeem reverts. From Mar 18 the true sentence is "V5 closes the moment the upgrade after V6 lands, whenever that is" — a cliff with no notice, never a future date (one appears only when V7 came before the floor, or through paused seconds). The design jumps from "at least Mar 17" to "last day passed", and "later if the next upgrade comes later" reads as time gained. Fix: a fourth state once `now > flip + 180 d` with `afterNextAt == 0` — chip `could close any day`, "The 180 days are over. V5's exits close the day the upgrade after V6 lands: claim it now." — on the row and the old origin's hero; §9.3.4 carries the rule.

**high · OldOriginQuiet; §5.9 "Quiet (last day passed)".** Two events months apart share one board: V5's operators stopping the prover (days after the flip; what is still on V5 cannot leave) and the portal's last day (≥ Mar 17; `onPortal` turns every witnessed row `closed` before anything else, `redeem` and `forward` revert `DeadlinePassed`). The title says "V5's last day has passed" under the chip "V5 stopped proving · Sep 21", and the held row still offers "redeem it on Ethereum … until at least Mar 17" — after the real last day that row is `last day passed` and the runbook has the origin taken down. §9.3.1's "the runbook's recorded stop" is a step `docs/upgrades.md` does not have. Fix: split it. "V5 stopped proving · Sep 21": title "V5 has stopped. What's still here can't leave.", body "What V5 proved in time is held on Ethereum for V6, or already there.", the held row and its redeem unchanged. The last-day state: held and ready rows `last day passed`, no redeem link. Add the stop to the runbook, or derive it from the chip's age alone.

**medium · States, ExitEdge · headroom before the flip.** "It goes through as the limit grows, in order; nothing to do." The portal has no queue: `_requireOpen` is `amount <= headroom` at call time, whoever forwards first when there is room wins, a smaller exit passes a larger one; and for kind 1 nothing goes through by itself — the row turns `ready to claim` and the user claims. Fix: "It becomes claimable as the limit grows: the row turns 'ready to claim'. Nothing to do until then." (kind 2: "Yacana forwards it once there is room, or you do.")

**medium · §5.4 "held > 6 h after V6 opened", §9.3.2.** The source named is `takingLong`, which counts from `updatedAt` — when the record entered `held`, which before the flip is the moment it was witnessed. A send made three days before the upgrade reads "Yacana hasn't forwarded it yet. Forward it yourself from V6" while V6 does not exist (today's `TakingLongDialog` has the same bug). Fix: the clock starts at the later of held-at and V6's `VersionRegistered`, and runs only while `canonicalRegistered` is true.

**medium · AccountErrors.** "The passkey prompt was dismissed" and "No passkey for Yacana on this device" are one error: WebAuthn returns `NotAllowedError` for both, by design, so credentials cannot be enumerated; the page cannot choose the note. "Another tab holds this account · Continue here; that tab stops mining" promises a takeover with no mechanism: `deleteDatabase` sits `onblocked` until the other tab closes (wallet.ts:116); no BroadcastChannel, lock or `versionchange` hand-off exists. Fix: one note — "That didn't work: the prompt was dismissed, or this device has no passkey for Yacana yet. Try again, use the device that has it, or enter 12 words."; the held tab: "Close that tab, then Retry", or a §9.3 item for the hand-off.

**medium · §9.1.10 and the "didn't finish" row.** The record is created before the send and the hash written when it returns (`flows.ts` `sendRecorded`: "a transaction sent may still be included after the page is gone"); `session.ts` `txByTag` re-finds such a record once mined. Expiring hashless records "on load" into a final state labels a real burn "Nothing left your balance", freezes it (final states never move) and never fetches its witness. Fix: expire only after the tag lookup has missed past the node's transaction TTL, and keep "didn't finish" re-adoptable by tag.

**medium · MinePrestoFallback, §5.3, §9.3.5.** One line, "Presto stopped answering", for nine reasons. `presto.ts` `causeText` has `denied` ("Presto has not approved <site> yet — approve it in the Presto app, then retry"), the common first run, plus cooldown, busy, invalid proof, update needed, encrypted connection off; `noticeFor` has the `downloading` state (bb fetched before the first native proof), during which the pill has no ✦ while the row says "native prover". Fix: a line per reason in the deck (the SDK's text serves), `denied` and `downloading` drawn; Retry rebuilds the prover (`fallbackReason` clears only on a rebuild).

**medium · WalletPhone.** The row keeps the desktop's two columns: the sentence wraps eight lines in a ~100 px column beside the chip, the trail breaks into three rows. Fix: chip under the amount line, sentence full width, trail wrapping at two rows.

**medium · OldOrigin, a missing board.** The runbook keeps v5.yacana.network up until the deadline, but V5's node goes away long before ("once V5's node is gone", step 10). Then the preflight fails before sign-in, OpeningErrorNode's "Change node" has no answer on a retired version, and the witness on V5's own origin is read from the node, not the served archive (`servesVersion`). Fix: "V5's node has shut down. Nothing more can leave from here. What V5 proved in time shows on V6 at yacana.network; a device that never held it restores the recovery file there." No Change node on the old origin.

**medium · rule 7, §8; Main, Disclosure, States.** "A send is safe once V5 proves it" is false in the portal's terms: a proven send can still end `over the limit`, `paused` or `closed`, as the table says. Meta text, but the blueprint inherits the rule. Fix: "a proven send is out of V5's reach; what can still stop it is in the table."

**low · vocabulary.** Chip "on its way to Ethereum" vs trail and stepper "reaching Ethereum"; "arriving on V6" (States) vs "arriving" (AheadRows); kind-2 rows inherit "Bridge again" where the verb is "Send ahead again"; "claims 2 of 4" beside "wins". One word per state.

**low · MineMining ledger.** "✓ minted in block 83,164" carries no "final once its epoch is proven" while the same mint does in Wallet (§9.3.3 names the signal; the deck does not).

**low · States, last row.** "V5 didn't prove the claim's epoch": the claim lands on the destination (V6 for a send-ahead); name the claim's version.

**low · K3 dropped.** "Nothing left your wallet": a deposit included after its `deadline_` reverts and the gas is spent. "No YACA left your wallet."

**low · WordsLogInError.** The phrase is BIP39 with a checksum (`validateMnemonic`): twelve listed words can still be refused, and a valid but wrong phrase opens a different, empty account. Add "These words don't form a valid phrase: one is off", and on a first login that finds nothing, "New here? A mistyped word opens a different, empty account."

**low · NodeStates.** "Switching · Mining carries on": `switchNodeLive` pauses mining for the rebuild and resumes after.

**low · fixtures.** MineSent shows 3.5 tYACA after 3.5 was sent and 1.2 mined since; MineFlipped's ledger is "claiming" at 16:07 after mining ended at 14:02.

**low · SendForm.** One screen drops the review but leaves no place for `review()`'s refusals (not an Aztec address, this account, zero, more than the balance): field errors. Say "mining pauses while it proves", as the send-ahead's How it works does.

**low · ToEthProving vs rule 5.** "Keep this tab open while it proves" is right (a closed tab is "didn't finish") and the rule says never; amend the rule.

**low · Claim dialog.** A portal revert between the 15 s refresh and the transaction (`WaitsForHeadroom`, `VersionPaused`, `DeadlinePassed`) surfaces as the wallet's raw error; `revert.ts` names them — map to the row's sentences.

**low · AccountErrors, "belongs to a different account".** Drawn on Welcome back, where Open with passkey restricts `allowCredentials` to the stored id (session.ts:346) and the case cannot arise; it belongs to the unrestricted Log in, which the dialog never offers while an account is stored. Say where it triggers, or drop it.

**low · pre-flip deadline.** Before the flip, "Mar 17" is 180 days after the announced date; a flip on Sep 16 makes the floor Mar 15. Pre-flip: "180 days after the upgrade", no date.

## 3. Verdict

**REVISE.** To APPROVE: (1) the post-floor deadline state, and "V5 stopped" split from "last day passed" on the old origin; (2) the state table's three sentences rewritten against the contract and the session — headroom "in order / nothing to do", the 6 h clock, the hashless expiry; (3) the account dialog's two undecidable notes fixed and Presto's per-reason lines drawn.
