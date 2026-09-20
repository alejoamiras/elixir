REVISE — high confidence on protocol and rendering findings; moderate confidence on untested usability recommendations.

1. **High — §5.9, §8, OldOrigin: proven does not mean permanently safe.**  
   “Sends proven in time are safe” is false: `YacanaPortal._requireOpen()` applies the deadline, pause and exit limit to both forwarding and redemption. `deadline()` remains open-ended until both relevant transitions are recorded; “Mar 12” cannot be a fixed promise. **Fix:** “Unclaimed sends expire after the exit deadline.” Show the live deadline beside Claim/Forward/Redeem, with year, timezone and countdown; show “Final deadline not yet set” when appropriate. Expired held sends must appear as expired.

2. **High — MineFlipped, OldOrigin, ExitRows: recent activity cannot guarantee escape.**  
   “Safe here while V5 keeps proving,” “stops for good,” and the green proving badge turn observations into guarantees. A reversed burn restores the old-version balance, not necessarily the ability to spend it. **Fix:** “Last proof received 12 minutes ago. Another proof is required for this send; completion is not guaranteed.” After confirmed rollback: “The send was reversed on V5. Moving this balance still requires V5 to process transactions.” Silence should display “Status unknown,” not “stopped.”

3. **High — SendAheadForm, §5.9: destination and delivery are overpromised.**  
   `_forwardTarget()` selects the newer, registered canonical version, which can skip V6; the runbook describes manual forwarding without a schedule. Login alone does not forward and claim every send. **Fix:** “Usually ready to forward in about an hour. Once forwarded, open the destination app and claim.” Label V6 as the expected destination until established. Explain before submission that an authorized relayer may forward it and that forwarding removes the Ethereum redemption option.

4. **High — §5.9, OldOrigin: recovery is demoted despite a documented dependency.**  
   The runbook says a fresh device needs the recovery file for an existing send once the old node is gone; “same passkey” does not explain this limitation. **Fix:** promote “Save transfer recovery file” after sending and update its status when proof data becomes available. Explain that it preserves transfer records and does not replace the passkey or words. Design the missing-file/archive-unavailable state.

5. **High — §5.4–5.6, §6, ExitRows: the failure-state design is incomplete.**  
   The copy deck omits journal states including `dropped`, `witnessed`, `headroom`, `closed` and `not-registered`; the pause row promises movement when the pause lifts despite other gates. **Fix:** specify copy, available actions and recovery for every state. Distinguish a growing limit from a frozen limit; expose the current pause expiry and remaining budget. Do not offer retry until non-submission is established, or claim that limits reserve a place.

6. **High — Create, Welcome, §5.1: account recovery claims are too broad.**  
   “Every device” and “synced by your device” are unsupported by the stored passkey result; the code explicitly handles authenticators without PRF support. “Try again, or use 12 words” implies words recover a passkey account. **Fix:** “Keep access to the password manager or device holding this passkey. Losing every copy loses access.” Show verified backup status only. Separate cancellation, unsupported-device and missing-passkey errors; offer words only for an account created with words.

7. **High — §5.1, §5.8, §9.1: one active account becomes destructive storage policy.**  
   “Use a different account logs out first” can discard an unbacked account unless it uses the same recovery gate as Sign out. Existing users may already have multiple records. **Fix:** require one active account per page, preserve existing records during migration, and route switching through backup checks. Distinguish locking from removing an account locally. `excludeCredentials` prevents specified credential duplication; it does not enforce one account across devices. [Google checklist](https://web.dev/articles/passkey-checklist)

8. **High — ToEthForm, ClaimReady, FromEthForm, PhoneBridge: payment prerequisites are missing.**  
   “The wallet pays the gas” obscures that the user needs ETH; the claim dialog omits Sepolia, and the phone loses the privacy disclosure. **Fix:** show “Ethereum Sepolia,” inspectable full recipient, and “You need Sepolia ETH to pay the claim fee.” Design wrong-network switching, rejection, insufficient ETH, wallet disconnection and destination changes. Replace “no fee” with “Yacana sponsors this fee” when sponsorship is available.

9. **High — Wallet, claim flows: success and retry need stronger distinctions.**  
   `claimSettled` and `recheckClaim()` explicitly allow an included Aztec claim to be reversed; the proposal treats “claimed” as finished. **Fix:** distinguish “Added to balance · awaiting final confirmation” from settled completion. If reversed, explain why Claim returns. Preserve transaction references through timeouts and wallet errors; use “Checking transaction status” before offering another send or claim.

10. **High — Wallet’s primary Send action: its redesign is absent.**  
    The existing `SendSheet` supports private/public transfers and warns that an unknown private recipient could receive unreadable notes. **Fix:** include the Send flow, recipient validation, privacy choice, review, submission and failures in this design pass—or explicitly retain its current safeguards. A primary money action cannot remain unspecified.

11. **Medium — Settings, NodeStates: operational and security consequences disappear.**  
    The proposal covers editing but not ongoing silence, rate limiting, stale balances or a rebuild failing after a successful probe. “Sealed under a device key” also hides what Stay open means. **Fix:** retain last-updated timestamps and contextual Retry/Change connection actions; distinguish probe success from completed switching. Use “Anyone who can use this browser may be able to open and spend from this account without your passkey.”

12. **Medium — Opening, §5.2, transaction progress: completion behavior is ambiguous.**  
    Start mining opens onboarding, but successful opening only starts mining when the resume setting is enabled. “First time only” ignores cache loss; elapsed seconds do not justify percentage bars. **Fix:** preserve the initiating intent, label authentication according to the method, and use measured bytes/blocks only for determinate progress. Specify cancel-before-submission versus close-and-track-after-submission behavior, including slow and failed stages.

13. **Medium — MineSignedOut, MineMining, MineFlipped: the cockpit still assumes expertise.**  
    “Epoch,” “escape hatch,” “bar ×0.62” and “Preparing the prover” lack a retail meaning. MineFlipped retains an active-looking power slider and “once you start” copy after mining ends. **Fix:** use “Round,” “Winning score” and “Preparing your account”; move technical calculations into details. After retirement, retain session history and remove irrelevant controls. Explain that a win still needs a successful reward claim.

14. **Medium — ToEthSent, NodeStates, shared components: the rendered hierarchy breaks.**  
    Titles and descriptions concatenate visibly; active steps use completed wording such as “Proven to Ethereum.” Chip shapes resemble buttons, and warning colours also label ordinary waiting. **Fix:** place descriptions below titles, use “Waiting for Ethereum confirmation,” and standardize passive status versus actionable controls. Essential `ink-4` text has approximately 1.88:1 contrast on raised panels; replace it with a readable token. [WCAG contrast requirements](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)

15. **Medium — Nav, PhoneBridge, §7: the recommendations need fairer alternatives.**  
    A bottom sheet is provisional until keyboard, scrolling, focus return and dismissal states are shown; mobile removes Verify and duplicates Settings. Options 5/6 omit ordinary accessible sign-out and simply hiding an irrelevant slider; checkbox consent is not evidence of comprehension. **Fix:** keep page-first and the compact form as defaults, demonstrate sheet versus full-page behavior with a keyboard, retain a discoverable Verify route, and test the warning’s comprehension separately from its checkbox.

16. **Low — §9, Wallet fixtures: bugs and decisions are mixed.**  
    Single-slot storage, dimming, probe timing, navigation and container choice are design decisions; disappearing deposits, mutable controls during submission and malformed version names are bugs. Wallet says four activities but shows five, and its timestamps contradict “newest first.” **Fix:** separate defects, approved decisions and unresolved capabilities; make fixtures internally consistent before approval.

### What looks right

- Page-first arrival with a visible Start mining action.
- One Activity list with actions attached to their transfers.
- Inline connection editing and retained working settings.
- A focused retired-origin page.
- Moving repeated host-trust copy into Settings and the FAQ.