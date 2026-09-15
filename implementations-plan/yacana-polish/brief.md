# Yacana polish — the UX/UI redesign brief (design pass, 2026-09-15, v3)

The bridge shipped and works (stack #41, #44, #45 on `main`). The owner walked the live site by hand and the
verdict was: the paths work, the experience is "pretty awful". This pass designs the application the owner
would be proud to ship to the masses: onboarding, copy, states, navigation, the bridge flows, the old origin.
UX and UI only; the implementation blueprint follows the owner's approval of this brief and its canvas.

Inputs: the owner's list (§1), what the app says today (`recon.md` §A–B), Bazaar's sign-in (`recon.md` §C),
the research digest with sources (`research.md`), the review rounds (`reviews/round-1.md`, `reviews/round-2.md`:
Codex and a Fable reviewer; every finding checked against the portal contract and the crossing journal). Output:
this brief (the decisions, the copy deck, the options), the canvas (`canvas/`, 84 artboards, published as a
Claude Design artifact) and the list the blueprint carries (§9).

v2 changes, in one paragraph: nothing says "safe" any more; the last day is "at least Mar 17" until the contract
sets it; the send-ahead shows its forward step and the relayer is defined once; every one of the journal's
seventeen states has a sentence and a board; the account dialog has its six failures; the claim on Ethereum
states the network, who pays and the rejection; the Send flow is drawn; a disabled button says why; the
cockpit loses "escape hatch"; the stepper renders right; the testnet tag is neutral.

v3 changes (round 2), in one paragraph: a record that lost its hash says "checking" while the session looks
for it by its log tag, and "didn't finish" only once nothing is on the chain after the send expired; "by 17:03
at the latest" becomes "V5 must prove it by 17:03, or the balance comes back here" (a deadline for V5, not an
arrival promise); the pause copy follows the contract (60 days in all, liftable early, stacking from the
current pause) and a pause warns without disabling anything; the exit limit has no queue ("whoever claims first
uses it"); redeeming needs the bridge open; deposits closed is for good; an unregistered version disables
deposits too; the pruned claim names Aztec, not a version; the old origin's end state is "V5 has stopped
proving" (the last day is months later and has its own row); the recovery file "lets another device pick this
send up"; Send shows the full address and asks to confirm it with the recipient, and the code validates what
is submitted; the claim dialog has a no-ETH state; sign-in failures say what the browser can know ("Sign-in
didn't complete", "close that tab, then retry"); a node switch pauses mining; the epoch tile says "anyone can
close it"; MineSent's balance is what is left; nothing "is safe" anywhere in the brief either. From the Fable
round: the last day has four readings, and after the 180 days with no upgrade after V6 in sight the row turns
red, "could close any day" (the portal closes V5 the moment that upgrade is observed); the old origin has a
state for V5's node being gone; "longer than usual" starts its clock when V6 opens, not when the send was
held; Presto's row has a line per reason; the phone's activity row is one column; the chips say "reaching
Ethereum" and "arriving" everywhere; a send-ahead's retry is "Send ahead again"; the words login has the
checksum error and the empty-account hint; Send has its four field refusals; the ended cockpit's ledger is
from before the end; the epoch tile counts "wins".

## 1. The owner's list, mapped to surfaces

| # | Surface | The complaint (owner's words, shortened) | Answered in |
|---|---|---|---|
| 1 | Sign-in | A passkey account and a 12-word account can exist at once; the dialog shows "open with passkey" and "open". One account per page. | §5.1 |
| 2 | Sign-in | The dialog looks weird: link-like phrases fly around. Wants Bazaar's shape: "Create account" / "Log in", then "Continue with passkey" with a one-line "use 12 words instead". Likes "Open with passkey" when semi-logged-in. | §5.1 |
| 3 | Everywhere | "Whoever serves this page controls it…" is said constantly. | §3 rule 4, §5.7 |
| 4 | Opening | The loading bar is broken; "notes and balances" takes the longest. | §5.2 |
| 5 | Sign-in | "Not now — just watch" leaves a grey overlay; "Sign in to mine" doesn't pop. | §5.1, §5.3 |
| 6 | Mine chart | The difficulty step at an epoch close can hide under the miner's own mark. | §5.3 (drawn on MineMining) |
| 7 | Wallet | Deposits from Ethereum don't appear in the Bridge list. | §5.4 |
| 8 | Mine | Presto's local-network check runs before sign-in; should run at "Start mining". | §5.3 |
| 9 | Mine chart | The x-axis reads "−3 min" before anything happened. | §5.3 |
| 10 | Mine | Balance tile: drop "1 claim this session" and maybe the account chip. | §5.3 |
| 11 | Sign out | "Hold to sign out" still feels like Bazaar. | §5.8, option 5 |
| 12 | Opening | "The proving keys are 20 MB…" is not retail-key information. | §5.2 |
| 13 | Settings | One Network section; no "Check" then "Use"; far less text; a stepper while it changes. | §5.7 |
| 14 | Mine | The power slider with Presto connected: verbose; one line or something with Presto's brand. | §5.3, option 6 |
| 15 | To Ethereum | Step 1 and 2 are almost the same; step 2 is verbose ("fee", "claimable"). | §5.5, option 3 |
| 16 | To Ethereum | Only loading status is "Proving and sending…" on the button; is Presto proving it? | §5.5 (the stepper says "in your browser; Presto proves only mining work") |
| 17 | To Ethereum | After sending, "burned in block" tick instead of a stepper. | §5.5 |
| 18 | To Ethereum | "pending: claim on Ethereum · 0x… from the wallet page" — what? | §5.5 |
| 19 | Inputs | "tYACA"/"YACA" misaligned with "MAX". | §4.3 |
| 20 | To Ethereum | "Progress stays in Wallet; claim it there once it is proven." | §5.5 |
| 21 | From Ethereum | Double "Connect injected" / "Connect Rabby"; not the normal connect flow. | §5.6 |
| 22 | From Ethereum | "each lands with a tap" + a weird bar; "on this version" confusing; the Claim button floats. Chips are great. | §5.4, §5.6 |
| 23 | v5 origin | Should not serve the landing; `/` → `/mine`? | §5.9 |
| 24 | v5 origin | "…a bet that V5 proves one more epoch; leaving it is a sure loss." feels unsafe. | §5.9, §8 (no bet, no "safe" either) |
| 25 | Send ahead | "Lands on Vthe next version" → name it or "the next version". | §5.9, §9 |
| 26 | Send ahead | Input alignment; the balance twice; "all" unclear. | §5.9 |
| 27 | Send ahead | "some of it" clickable while proving. | §9 |
| 28 | Send ahead | "Its proof is due on Ethereum by 14:03, or the burn is undone; then it is held there…" — what? | §5.9 |
| 29 | v5 origin | Only the v5 stats link and the "retired · send ahead" form; re-brand the tabs. | §5.9, option 7 |
| 30 | Send ahead | "forwarded … by hand, or by you" → "by a trusted relayer, or you". | §5.9 ("Yacana forwards it"; the relayer defined once, in How it works) |
| 31 | Sheets | Step titles look greyed while descriptions read clearer. | §4.3, §9 |
| 32 | Nav | The logo doesn't go to the app's base URL. | §5.10 |
| 33 | Bridge | Not sold on the right-side modal. | option 2 |
| 34 | Header | "testnet · fees sponsored" → "testnet". | §5.10 |
| 35 | Settings | "Copy diagnostic (shortened)" — remove. | §5.7 |
| 36 | Nav | Tabs and navigation can be improved; maybe icons. | §5.10, option 4 |

## 2. Who the user is

A curious person who read the landing and clicked "Mine on testnet". They own a browser wallet (MetaMask or
Rabby), understand "testnet" loosely, and have never heard of an epoch, a proof deadline, a rollup version or
an Outbox witness. They want four things, in this order: start mining fast and see it working; see coins
arrive; move coins to Ethereum and back without losing them; not be hurt by an upgrade they didn't ask for.
They read one sentence, then look for the button. Everything else is one level down.

## 3. The ten rules (from `research.md`, made Yacana's)

1. **One account, one primary action.** A browser holds one account. Every screen has one verb in colour;
   every alternative is a quiet link. Never two peer buttons for the same decision.
2. **The sentence first, the mechanism one level down.** A card says what is true and what happens next; a
   "How it works" opens the stages; the contract's rules live on `/faq#rules`. Never a third level.
3. **Say what happens next, not how the machine works.** "Reaches Ethereum usually within the hour" beats
   "proven to Ethereum with its epoch". Money words: balance, send, claim, bridge; not burn, exit, witness,
   commit. "Usually" wherever the protocol only usually does it.
4. **Risk only where the user can act, said once.** The host-trust sentence lives on `/faq` and in
   Settings › About. A deadline is stated beside the button that meets it, as a date and a countdown, and only
   once it exists.
5. **Every wait is a stepper.** Named stages, a checkmark per stage, a time expectation once ("usually under a
   minute"), a determinate bar where bytes or blocks are known, elapsed time otherwise. Never a bare spinner,
   never a label on a button as the only status; "keep this tab open" only while the browser is still proving
   (a closed tab there is a send that never happened), never once a transaction is sent.
6. **Buttons are verb + noun, sentence case, carrying the amount when money moves.** "Bridge 3.5 tYACA",
   "Claim on Ethereum", "Send 3.5 tYACA ahead". No article, no period.
7. **Deadlines are facts, not bets; nothing is "safe".** "By 14:03 (in 40 min)" and what happens after it:
   "If V5 misses it, the balance comes back here." A proven send still needs forwarding or redeeming before
   V5's last day, and a balance on V5 can lose its way out at any time; so the word never appears. Never "a sure loss"; "without notice" is a fact about V5, said once, not a threat.
8. **Settings edit in place.** One field per value, Save probes it, the old value stays live until the probe
   passes, the error sits under the field; the row keeps saying how the node is doing.
9. **Four destinations, a gear, an account chip.** Icon + label on the phone, text tabs on the desktop; the
   logo is the app's home; "Testnet" is a neutral tag. Stats and Verify open in a new tab because mining
   lives in this one.
10. **The old origin has one job.** Get what's left out. It shows the balance, one button, the activity, the
    settings that make it work. Nothing else.

## 4. Information architecture

### 4.1 Surfaces and what each shows

| Surface | Shows | Never shows |
|---|---|---|
| **Mine** | Your proofs live, the epoch, the bar, rate/next/best, the proofs ledger (★ win · claiming · ✓ minted), your balance with Send / Wallet, the upgrade card when one is announced, the Presto row when it is in the way. | Account chips, session claim counts, host warnings, the bridge. |
| **Wallet** | The balance with the three money actions (a disabled one says why), the account (address, method, backed up, Sign out), **Activity** (every crossing: to Ethereum, from Ethereum, send-aheads; seventeen states, one sentence each, the action where you must act), wins collapsed, the upgrade card when announced, "advanced" (recovery file, restore). | Contract addresses (Stats › Bridge has them), host warnings. |
| **Stats ↗ / Verify ↗** | The public view (unchanged in this pass). On the phone Verify is a tab inside Stats. | — |
| **Settings** (gear) | Network (Aztec node, Ethereum RPC, with their silent and throttled states), Mining, Alerts, Account (Stay open, said plainly; Sign out), Appearance, About. | Diagnostics copy, prose paragraphs. |
| **The account dialog** | Create / Log in / Welcome back / Opening; six failures, each one note. | Warnings that belong to the FAQ. |
| **The transaction dialog** | One flow at a time: form → progress → done; Send; Claim; Send ahead. | A second confirmation. |
| **v5.yacana.network** | "Send ahead": balance, Send ahead to V6 / Bridge to Ethereum, activity, Log in; Settings (node, RPC, account with Sign out, about); Stats ↗ (apex). | The landing, mining, deposits, a Wallet tab, forwarding (it happens on V6). |
| **/faq** | The rules, "Who controls this page?", "What if I lose my passkey?", the upgrade in full, what a relayer is. | — |

### 4.2 Disclosure levels

- **Level 0 — the chip**: the header's version tag and status pill; an activity row's state chip; the
  upgrade's "V6 · Sep 18" tag; the old origin's live chip ("V5 proved an epoch 12 min ago").
- **Level 1 — the card**: one sentence of fact, one of what happens next, one button, the one consequence of
  not acting. (The upgrade card, an activity row, the balance tile, the retired page's hero.)
- **Level 2 — the dialog's "How it works" / the row's "Details"**: the stages with times and links, the
  deadline, who forwards, the recovery actions.
- **Level 3 — /faq#rules**: the exit limit, the pause budget, the last day, who may do what. Linked from
  level 2, never inlined.

### 4.3 The shared components this pass changes

- **Amount field**: the number, the unit and the MAX chip share one baseline row; the unit is the ticker of
  the side the money is on (tYACA on Aztec, YACA on Ethereum); "balance 3.5 tYACA" under it, once.
- **Stepper**: title tones `todo: ink-2`, `active: ink`, `done: ink-2 + ok dot`, `failed: bad dot`; the detail
  `ink-3` on its own line under the title; a right column in mono for time or link; a determinate bar under
  the active step only where bytes or blocks are known. Active steps use the active verb ("Reaching
  Ethereum"), never the finished one.
- **Activity row** (replaces JournalCard + ArrivalCard): amount + direction, the state chip + time at the
  right, one sentence, the chips trail, the action button when there is one, "Details" for links and recovery.
  The trail's vocabulary: `sent › block 83,131 › reached Ethereum › claim on Ethereum` (to Ethereum),
  `sent from Rabby › crossed to Aztec › claim › in your balance` (from Ethereum), `sent › reached Ethereum ›
  held for V6 › forwarded to V6 › claim on V6` (send ahead). A "claimed" row carries "final once its epoch is
  proven" until it is settled.
- **Transaction dialog**: 440 px centred on desktop, a bottom sheet on the phone that scrolls and whose
  button rides above the keyboard; the same frame for send, bridge to/from, claim, send ahead.
- **Account dialog**: 440 px centred; each screen has one primary and at most two quiet links; a failure is a
  note under the button, which stays.
- **Status chips** (`.st`): the dot + mono label; ok / on / warn / bad / dim. A chip is never a button.
- **Testnet tag**: neutral (ink-2 outline), not amber; amber is for warnings.

## 5. The flows

### 5.1 Sign-in (the Bazaar shape, in Yacana's voice)

**Single account.** One account per browser (one record slot). Creating or logging in when a different account
is stored fails closed: "That passkey belongs to a different account. This browser holds 0x22a9…612a. Sign that
account out first to switch; it asks about backup before it goes." The dialog never offers "Create a new
account" while one is stored. "Use a different account" opens the Sign out dialog (§5.8) with its backup gate;
the stored record is replaced only after the new account has opened. Existing browsers with two records keep
both until one is signed out; the Welcome screen shows the most recently opened one.

**Arrival.** No dialog on arrival for a new visitor: the cockpit is live at full contrast with **Start mining**
in the loop tile and a quiet "Log in" in the balance tile; both open the dialog. (Option 1.) Start mining
carries its intent: once the account opens, mining starts. A device with a stored account gets the lock screen
on arrival: **Welcome back** + **Open with passkey**, quiet "Just watch for now" · "Use a different account".

**Screens** (each: eyebrow, title, one body line, one primary, quiet links):

- **Start** — eyebrow `account`, title "Mine with an account.", body "Your balance lives in an account only
  you can open. It takes a tap." Buttons **Create account** (uv) · **Log in** (secondary). Quiet: "Just watch
  for now".
- **Create** — title "Create your account.", body "A passkey signs you in with your face, fingerprint or
  device PIN. Nothing to write down." Note (warn): "**Your passkey is the only key.** Keep it in a password
  manager that syncs (iCloud Keychain, Google Password Manager, 1Password) and it opens this account on the
  devices that manager syncs to. Lose every copy and the account is lost; Yacana can't recover it." Checkbox
  "I understand my passkey is the only way into this account." — unchecked; **Continue with passkey** stays
  disabled until it is ticked (option 8: friction on purpose, not proof of understanding). Quiet: "Use 12
  words instead". Back arrow.
- **Log in** — title "Welcome back.", body "Log in with the passkey you created, or your 12 words." Button
  **Continue with passkey** (busy "Logging in…"). Quiet: "Use 12 words instead". On the old origin an info
  note above the button: "Accounts are restored here, not created. The passkey or 12 words from
  yacana.network open it."
- **Your 12 words** (create) — title "Write down your 12 words.", body "Made on this device, never sent
  anywhere. They are the only way back into this account." The 12 numbered cells, **Copy** (kept: password
  managers are the common home for a phrase); checkbox "I've written them down." reveals "Confirm: type words
  3, 7 and 11" (three inputs, paste off); **Finish setup**; quiet "Back up later" (the account then shows "not
  backed up" in Wallet, and Sign out gates on it).
- **Enter your 12 words** (log in) — body "Type or paste the words you saved." Line: "You're on
  yacana.network. Yacana never asks for your words in chat, email or support." Textarea, counter "7 of 12";
  **Log in**; quiet "Back". A wrong phrase: the field turns red and the counter line says which word ("Word 12
  isn't in the list: check 'quartzz'.").
- **Welcome back** (stored account) — the account chip (`0x22a9…612a · passkey` or `· 12 words`), **Open
  with passkey** (**Enter 12 words** for a words account); quiet "Just watch for now" · "Use a different
  account". Never "synced": the page cannot know.

**The failures** (board AccountErrors; each a note under the button, one line what happened, one what to do;
the button stays):

| Case | Note | Primary |
|---|---|---|
| The passkey prompt was dismissed or timed out | "That didn't work. The passkey prompt was dismissed or timed out. Try again, or use 12 words." | Continue with passkey |
| The authenticator can't derive a key (`NoPrfError`) | "This device can't make a Yacana passkey. Its passkeys can't derive a key. Use 12 words instead; they work everywhere." | Use 12 words |
| No WebAuthn | "This browser has no passkeys. Use a current Chrome, Safari, Edge or Firefox; or use 12 words." | Use 12 words |
| Log in, the prompt ended without a passkey (WebAuthn cannot tell "none here" from "dismissed") | "Sign-in didn't complete. No passkey was used. If this device has none for Yacana, log in where you created it, or enter your 12 words." | Continue with passkey |
| Log in, the passkey exists but can't derive the key (`NoPrfError`) | "This device can't open a Yacana passkey. Its passkeys can't derive the key. Log in on a device whose passkeys can, or enter your 12 words." | Enter 12 words |
| Another tab holds this account (`ChainViewHeldError`: there is no takeover; the other connection must close) | "Another tab has this account open. Close that tab, then retry here." | Retry |

"That passkey belongs to a different account" is not a case: Open with passkey restricts the browser to the
stored credential (`allowCredentials`), and Log in is offered only when nothing is stored. The words login has
two refusals: "Word 12 isn't in the list: check "quartzz"." and, for twelve listed words that fail the phrase's
checksum, "These 12 words don't form a valid phrase: one is off. Check each against what you saved." A words
login that opens an empty account gets one line on the Wallet's empty state: "Expected a balance? A mistyped
word opens a different, empty account: check your words."

Gone: "Sign up with a passkey", "I already have a passkey", "I have twelve words", "Use another passkey",
"Enter twelve words instead", "Create a new account", the two footers, the dimmed cockpit, "synced by your
platform".

### 5.2 Opening (the progress)

Title "Opening your account." A checklist with a checkmark per stage and one thin bar under the active one,
only where the count is known:

1. **Passkey confirmed** ✓ (or **12 words accepted**)
2. **Preparing your miner** · first time only — bar with `13 of 20 MB` in mono at the right (a download is a
   download; the number sets the expectation without being the headline). Kept on this device; if the cache
   is gone the step simply runs again.
3. **Syncing your private balance** · "Reading your notes from the chain. Usually under a minute; the first
   time takes longer." — determinate by blocks when the sync reports them (`block 83,102 of 83,117`), else the
   elapsed time (`0:42`).
4. **Ready to mine**.

Footer: "Mining starts when this finishes. Cancel keeps you watching the chain." when Start mining opened the
dialog; "You can start mining when this finishes." from Log in. **Cancel** (nothing has been submitted; it is
a plain cancel). The dialog closes itself on Ready; mining starts because Start mining opened
it (or, from Log in, if "Resume mining when the page opens" is on).

**Failures** (board OpeningError…): a failed stage gets a red dot and its reason at the right; a note under
the checklist says what happened and what to do; **Retry** keeps what arrived. "The miner's files didn't
download. The connection dropped at 13 of 20 MB." / "The Aztec node isn't answering. v5.testnet.rpc… stopped
answering, or is rate-limiting this page. Retry, or use another node." (**Retry** · **Change node**).

### 5.3 Mine

- **Signed out**: the cockpit at full contrast (no `data-signed-out` dimming). Loop tile header "your proofs"
  with **Start mining** (uv). The chart shows "Your proofs draw here once you start · The bar is 1.0 · clear it
  to win" in place of "−3 min"; the epoch rail, difficulty and network figures are live. The balance tile:
  "Your balance shows once you log in." with a quiet **Log in**.
- **Signed in, idle**: **Start mining**. The chart's window grows from the start ("since 16:05" at the left
  edge, "now" at the right) until it reaches three minutes, then "last 3 min".
- **Mining**: **Stop**. The bar is a step line; at an epoch close a small tick on the top edge reads
  `epoch 12 · bar 2.0 → 1.6`; a win is a ring above the line with a short drop that ends above the bar, drawn
  at the proof's own x, so a step under a win stays visible (MineMining draws it). The proofs ledger keeps
  "epoch 12 opened · bar 1.6 (×0.83)"; a win reads "★ a win · claiming, about 20 s" until "✓ minted in block
  83,164 ↗ · 4 tYACA, privately"; the ledger's legend says "✓ minted, final once its epoch is proven" (the
  same signal as the Wallet's row, §9.3.3). The ended cockpit's ledger shows what was mined before the end.
- **The epoch tile**: wins (the epoch closes after four; "claims" was the contract's word), bar, open for,
  expected close, "next bar if it closed now ×0.62", "anyone can
  close it in 4 min" (`escapeHatchIn`: when the roll becomes callable by anyone, not an automatic close; was
  "escape hatch"). "Epoch" stays: it is the product's word on Stats, the landing
  and the FAQ.
- **Balance tile**: amount, "private", **Send**, **Wallet →**. No account chip, no session count (the "best
  this epoch" KPI already says "1 win · 4 tYACA this session").
- **Presto's reasons** (board PrestoReasons): the row says why it stepped aside, one line per reason the SDK
  reports (not approved yet, cooldown, busy, a proof that didn't verify, an answer the page couldn't use,
  needs an update, encrypted connection off, stopped answering, the browser blocks local access, a health
  report the page doesn't understand) with **Retry** where a retry can help; "fetching its prover" is the one
  that is not a fault, and while it runs the pill has no ✦. The pill always says what actually proved.
- **Presto**: probed once at **Start mining**, never on load. Not found: after that first start, a quiet row
  under the loop tile, "✦ Presto proves natively on this machine, several times faster · Get Presto ↗",
  dismissible. Installed but blocked: at Start mining, a note in the loop tile: "**Presto is installed, but the
  browser blocks local access.** Allow it for this site, then retry; or mine in the browser." **Retry** ·
  quiet "Mine in the browser". Connected: the status pill reads `mining ✦ presto`; the power row becomes a
  Presto row — "✦ **Presto** · native prover · 12 threads, set in the Presto app" with "Open Presto ↗" — and
  the slider is hidden (option 6). Dropped out (Presto stopped answering, busy, a proof that didn't verify: the
  SDK's reasons, one line each): the row turns amber — "✦ Presto stopped answering. Proving in the browser
  meanwhile · Retry when it's back" — the slider returns under it, and the pill drops its ✦ because the
  pill follows what actually proved.
- **Mining ended** (V5 after the upgrade): the pill reads `ended`; the loop tile's header "mining ended on V5 ·
  Sep 18 14:02" with no button and "Mining moved to V6 at yacana.network. Your proofs from this session stay
  below."; the epoch tile shows the last epoch, closed; no power slider; the ledger keeps the session.
- **The upgrade card** (when announced, or after a send) sits above the cockpit: see §5.9.

### 5.4 Wallet

- **Balance tile**: `3.5 tYACA` · "private"; **Send** (primary) · **Bridge to Ethereum** · **Bridge from
  Ethereum**. A disabled button says why in one line under the row (board WalletReasons): "Deposits into V5
  are closed for good. Bridge from Ethereum on V6, at yacana.network, once it opens." (`depositsClosed` is
  permanent per version) / "The Ethereum RPC isn't answering: bridging waits until it does. Settings" /
  "Bridging opens once Yacana registers V5 on Ethereum, at launch." (both bridge buttons: `deposit` needs the
  version registered too). A pause disables nothing: "The bridge is paused until Sep 20: claims on Ethereum
  wait until it lifts. Sending and deposits still work; a send now waits on Ethereum." (the L2 send works, the
  L1 claim waits, and after the flip a user must still be able to leave V5 during a pause).
- **Account tile**: `0x22a9…612a` (link), "passkey" / "12 words · backed up ✓" / "12 words · not backed up ·
  Back up now"; **Sign out**. The sign-out sentence moves into the dialog.
- **Activity** (one list; the fix for #7 and #22): rows for every crossing, newest first, each with:
  - line 1: amount and direction — `1 tYACA → Ethereum`, `0.5 YACA → here`, `3.5 tYACA → V6` — the
    counterparty in small mono (`0x90F7…b906`);
  - the state chip at the right and the time;
  - line 2: one sentence;
  - the chips trail (the owner's favourite), in the vocabulary of §4.3;
  - the action where one exists: **Claim on Ethereum**, **Claim** (arrivals), **Forward to V6** (on V6 only),
    **Redeem on Ethereum**, **Bridge again** (**Send ahead again** on a send-ahead); a quiet **Details** opens the
    links (Etherscan, block), the
    deadline, "Save a recovery file".
  - **Every state has a sentence** (board States; the table below is the spec). Money-loss states are red and
    say what happened.

| Kind · state | Chip | Sentence | Action |
|---|---|---|---|
| K1 proving | proving · 8 s | Proving privately, about 20 s. | — |
| K1 proving, no hash after a reload | checking | The page closed while this was sent. Checking the chain for it. | — (`txByTag` recovers the hash) |
| K1 checking, nothing on the chain after the send expired | didn't finish | This didn't finish. Nothing left your balance. | Bridge again |
| K1 sent | sent | Sent. Waiting for a block. | — |
| K1 dropped | not included | The node never included it. Nothing left your balance. | Bridge again |
| K1 proven-pending | reaching Ethereum | Reaches Ethereum usually within the hour; then you claim it there. V5 must prove it by 17:03, or the balance comes back here. | — |
| K1 witnessed | reached Ethereum | Reached Ethereum; reading the bridge for the claim. | — |
| K1 ready | ready to claim | Ready. Claim it on Ethereum with a wallet on Sepolia; that wallet pays the gas in ETH. | Claim on Ethereum |
| K1 ready, after the 180 days, the upgrade after V6 not seen yet | could close any day | The 180 days are over. V5's exits close the day the upgrade after V6 lands. Claim it now. | Claim on Ethereum |
| K1 minted-l1 | claimed | 1 YACA at 0x90F7…b906. | Etherscan ↗ |
| K1 never-proven | undone | V5 didn't prove this in time. The balance is back here. | Bridge again |
| K1 paused | paused · until Sep 20 | The bridge is paused until Sep 20: claims wait until it lifts. Yacana can pause for 60 days in all over V5's life, and can lift a pause early. | — |
| K1 headroom, before the flip | waiting for the limit | More has left V5 than its exit limit allows right now. The limit grows by the hour while V5 is current, and this turns ready to claim once it fits; others may use the room first. | — (Claim appears once it fits; nothing goes through by itself) |
| K1 headroom, after the flip | over the limit | V5's exit limit froze at the upgrade, and this is beyond it. It cannot leave. | Details |
| K1 closed | last day passed | V5's last day passed before this was claimed. It cannot leave any more. | — |
| K2 headroom | waiting for the limit | More has left V5 than its exit limit allows right now. Yacana forwards it once there is room, or you do from V6; a redeem waits the same way. | — |
| K2 closed | last day passed | V5's last day passed before this was forwarded or redeemed. It cannot leave any more. | — |
| K2 proven-pending | reaching Ethereum | Reaches Ethereum usually within the hour; then held there for V6. V5 must prove it by 14:03, or the balance comes back here. | — |
| K2 witnessed · held | held for V6 | Held on Ethereum for V6, out of V5's reach. Yacana forwards it into V6 once V6 opens; you can too, from V6. | Details: Redeem on Ethereum instead, until at least Mar 17 (…), while the bridge is open (`_requireOpen` gates `redeem` too: not paused, within the limit, before the last day) |
| K2 held > 6 h after V6 opened | longer than usual | Yacana hasn't forwarded it yet. Forward it yourself from V6, or check the Ethereum RPC in Settings. | Forward to V6 (on V6) · Redeem on Ethereum |
| K2 not-registered | waiting for Yacana | V6 is live, but Yacana hasn't opened its contract there yet. You can redeem it on Ethereum until at least Mar 17 (…). | Redeem on Ethereum |
| K2 held, after the 180 days, the upgrade after V6 not seen yet | could close any day | The 180 days are over. V5's exits close the day the upgrade after V6 lands. Forward it from V6 or redeem it now. | Forward to V6 · Redeem on Ethereum |
| K2 forwarded | arriving | Forwarded into V6; claimable there in a few minutes. | — |
| K2 claimable (on V6) | ready to claim | Arrived from V5. Claim it into your balance: one tap, about 20 s, no fee. | Claim |
| K2 minted-l2 | claimed | 3.5 tYACA in your balance. Final once its epoch is proven. | — |
| K2 minted-l1 (redeemed) | redeemed | Redeemed: 3.5 YACA at 0x90F7…b906 on Ethereum. | Etherscan ↗ |
| K2 flip verdict unknown | can't read the upgrade | Can't read the upgrade's state: the Ethereum RPC isn't answering. | Settings |
| K3 proving | waiting for Rabby | Confirm the deposit in Rabby. Nothing leaves your wallet until you do. | — (a dismissed prompt becomes `not sent`, which carries Bridge again; a prompt that is merely gone is not evidence the deposit was not sent) |
| K3 sent · deposited | crossing to Aztec | Sent from Rabby; crossing to Aztec, a few minutes. | Etherscan ↗ |
| K3 dropped | not sent | Rabby never sent it, or Ethereum didn't include it in time. No YACA left your wallet; if it was sent, the gas is spent. | Bridge again |
| K3 claimable | ready to claim | Arrived. Claim it into your private balance: one tap, about 20 s, no fee. | Claim |
| K3 claiming | claiming · 12 s | Claiming privately, about 20 s. | — |
| K3 minted-l2 | claimed | 0.5 tYACA in your balance. Final once its epoch is proven. | — |
| any minted-l2, then pruned | ready to claim | V5 didn't prove the claim's epoch, so it was undone. Claim it again: one tap. | Claim |

  The deadline sentence, everywhere it appears: "until at least Mar 17 (180 days after the upgrade; later if
  the bridge pauses or the next upgrade comes later)" while the contract's deadline is unset; the date itself
  ("until Mar 20") once the version after next has arrived and it is set. Finished rows collapse to one line
  after a week. Empty: "Nothing crossing yet. Bridges and send-aheads show here, with where they are." On a
  continuation with an empty journal (V6): "Sent ahead from V5 on another device? It shows here once Yacana
  forwards it; until then, restore its recovery file."
- **Send** (board SendForm…; the wallet's primary money action, in the same dialog): title "Send to an
  account."; amount `1.00 tYACA · MAX`, "balance 3.5 tYACA"; **To** (an address field); **How** · Privately |
  Publicly; rows "Fee · none · Yacana sponsors it", "Visible · nothing; a private transfer" (public: "the
  amount and the address, to anyone", with the warn note "This will be public…"); an address the chain does
  not know as an account gets the inline note "Nothing on the chain knows that address as an account. Sent
  privately, it could never be read there. Confirm the address with the recipient before sending." The pasted
  address shows in full (wrapping), never shortened, in every state of the form. Button **Send 1 tYACA
  privately**; under it, "proves in your browser, about 20 s · mining pauses meanwhile". The four refusals
  (board SendErrors) sit under their field the moment they are known: "Enter an amount." · "More than your
  balance." · "That's this account." · "Not an Aztec address: 66 characters, starting with 0x."; the button
  waits. The code validates the exact address, amount and mode it submits (not the values the probe saw) and
  freezes the form while it proves. Sent: ✓ Proved privately · 20 s → ✓ Sent · block 83,140 · "1 tYACA to 0x1a2b…9c8d, privately.
  Your balance: 2.5 tYACA." + "Final once its epoch is proven." **Done**.
- **Wins**: a collapsed row "Wins · 12" that expands to the ledger ("claims" was the contract's word).
- **Advanced** (quiet row): "Save a recovery file" · "Restore from a file". The contract chips move to Stats ›
  Bridge.
- The Wallet tab carries a count badge when a row needs the user (`Wallet · 2`), on the phone's bar too.

### 5.5 Bridge to Ethereum

One screen, no step 2 (option 3): the form carries a live summary and the button carries the amount.

- **Form** — title "Bridge to Ethereum". Amount `3.50 tYACA · MAX`, "balance 3.5 tYACA". **To**: the
  connected wallet as a chip (`Rabby · 0x90F7…b906 · Sepolia`) with quiet "Change" (paste an address); if
  none, **Connect wallet**. A pasted address shows in full, with the tag "pasted · not your connected wallet"
  and the line "Check every character. A bridge can't be recalled; YACA sent to a wrong address is lost."
  Summary rows: "Arrives · usually within the hour; then you claim it there"; "Fee · none here · gas in ETH
  when you claim, from the wallet that claims"; "Visible on Ethereum · the amount and 0x90F7…b906; not this
  account". Button **Bridge 3.5 tYACA**. Quiet "How it works" opens the four stages.
- **Proving** (same dialog, form replaced): title "Bridging 3.5 tYACA". Stepper: ● Proving privately · 12 s
  (bar) — "In your browser; Presto proves only mining work." (#16) → ○ Sent → ○ Reaching Ethereum · usually
  within the hour → ○ Claim on Ethereum. Footer: "Keep this tab open while it proves, about 20 s." No close.
- **Sent**: ✓ Proved and sent · block 83,120 → ● Reaching Ethereum · usually within the hour — "V5 must prove
  it by 17:03. If it doesn't, the balance comes back here." → ○ Claim on Ethereum — "With a wallet on
  Sepolia; it pays the gas in ETH." Footer: "You can close this. Wallet shows the progress and a **Claim**
  button when it's ready." **Done**.
- **Ready**: the row's chip `ready to claim` and **Claim on Ethereum**. The claim dialog: title "Claim 1 YACA
  on Ethereum"; rows "To · 0x90F7…b906 · chosen when you bridged" (the recipient was fixed at the send;
  whichever wallet pays, it mints there), "Paid by · Rabby · in Sepolia ETH · the gas, nothing else", "Then ·
  1 YACA at that address"; **Claim with Rabby** · quiet "Not now". Wrong network: the note "Rabby is on
  Ethereum mainnet. The bridge is on Sepolia. Switch, then claim; Rabby asks you to confirm the switch." and
  the primary becomes **Switch Rabby to Sepolia**. Then ● Confirm in Rabby — "Rabby asks you to confirm the
  claim and shows the gas." → ● Claiming · waiting for Ethereum → ✓ Claimed · block 6,912,004 · "View on
  Etherscan ↗" · **Done**. Rejected in the wallet: the step turns red, "Rabby rejected it. Nothing was claimed;
  the YACA is still yours to claim." **Try again**. No ETH (board ClaimNoEth; the page reads the payer's balance
  before asking the wallet): the note "Rabby has no Sepolia ETH for the gas. Add some to 0x90F7…b906, then
  claim. The YACA waits for you." with the button disabled; the row keeps its Claim. A portal refusal between
  the page's last read and the transaction (the limit, a pause, the last day: the ABI names them) is mapped to
  the row's own sentence, never shown as the wallet's raw error.
  The row after: `claimed` · "1 YACA at 0x90F7…b906."
- **Undone** (V5 missed the proof deadline): the row `undone` · "V5 didn't prove this in time. The balance is
  back here." **Bridge again**. The rare states (checking, didn't finish, not included, paused, the limit, closed) are
  on board ExitEdge and in the table above.

### 5.6 Bridge from Ethereum

- **Connect** — title "Bridge from Ethereum", body "Connect the wallet that holds your YACA." One button
  **Connect wallet**; small line "MetaMask, Rabby or any browser wallet. None installed? Get one ↗". One
  installed wallet connects directly; several open a picker (name, icon, "installed") — the EIP-6963 list
  wagmi already discovers.
- **Form** — the wallet chip `Rabby · 0x90F7…b906 · Sepolia` with ×; "7 YACA available". Amount `0.50 YACA ·
  MAX`. Rows: "Arrives · a few minutes; then you claim it here (one tap, no fee)"; "Fee · gas in ETH from
  Rabby · none here"; "Visible on Ethereum · your wallet and the amount; not this account". Button **Bridge
  0.5 YACA**. The announced-upgrade note stays (warn): "**Aztec upgrades to V6 around Sep 18.** A deposit now
  lands on V5 and would need sending ahead afterwards. Unless you need it here now, bridge after the upgrade,
  at yacana.network." Deposits closed (`close-deposits`, permanent for the version; a pause does not close
  them): the note "**Deposits into V5 are closed for good.** Aztec upgrades around Sep 18 and Yacana closed V5's
  deposits ahead of it. Bridge from Ethereum on V6, at yacana.network, once it opens." and the button disabled.
- **Progress** — ● Confirm in Rabby — "Rabby asks you to confirm the deposit and shows the gas." → ○ Crossing
  to Aztec · a few minutes → ○ Claim here · one tap. Then ✓ Sent from Rabby · Etherscan ↗ → ● Crossing to Aztec
  · a few minutes → ○ Claim here · one tap, no fee. Footer "You can close this. Wallet shows a **Claim**
  button when it arrives." **Done**.
- **Arrived** — the Wallet row `0.5 YACA → here` · `ready to claim` · "Arrived. Claim it into your private
  balance: one tap, about 20 s, no fee." **Claim** → `claiming · 12 s` (bar) → `claimed` · "0.5 tYACA in your
  balance." + "final once its epoch is proven". The ArrivalCard, its bar and "on this version" are gone. A
  claim whose epoch V5 never proved returns to `ready to claim` with "V5 didn't prove the claim's epoch, so it
  was undone. Claim it again: one tap."

### 5.7 Settings

Sections, each a card of rows: **Network** (Aztec node, Ethereum RPC), **Mining** (power, Presto row, pause
on battery, keep proving in a background tab, resume when the page opens), **Alerts** (notify, sound, tab
title, mini window), **Account** (address, method, stay open on this device, **Sign out**), **Appearance**,
**About** (source, build, bb.js, relying party, one line: "Yacana runs in your browser. Whoever serves this
page controls it; the source is public — run your own build if that matters." + "More on /faq").

**Stay open on this device**: "On: anyone who can use this browser could open and spend from this account
without your passkey. Off: one touch per open." (was "sealed under a device key").

**The node row** reads `v5.testnet.rpc.aztec-labs.com` · `block 83,117 · 12 s ago · 1.0 s · this deployment ✓`
· **Change**, and keeps reporting after the edit (rule 8, board NodeStates):

- Change → the row becomes a field with **Save** / **Cancel**. Save → an inline stepper under the field:
  ✓ Reachable · ✓ This deployment · ● Switching · "Rebuilding your view of the chain from the new node. Mining
  pauses until it's done." (`switchNodeLive` pauses the cockpit) · then the row again with `custom` and quiet
  "Use the default".
- A failed probe stays under the field ("Not this deployment's node (it serves rollup 1782110044). Kept
  v5.testnet…"); a rebuild that fails after a good probe too ("Couldn't rebuild your view from
  my-node.example.net: it stopped answering. Kept v5.testnet…"). The old node stays in use in both.
- Silent: `no answer for 2 min · your view is from 14:02 · mining paused` · **Retry** · **Change**.
- Throttled: `answering slowly · rate-limited · block 83,117 · 40 s ago` · "Public nodes throttle busy pages.
  It recovers on its own." · **Change**.
- The Ethereum RPC row is the same with "Sepolia · the bridge is there ✓ · 0.4 s".

**The old origin's Settings** (board OldSettings): Network, Account (the same account as yacana.network,
**Sign out**), Appearance, About. The account chip in its header opens Settings, since there is no Wallet.

Gone: "Check" then "Use", the three paragraphs, "Copy diagnostics".

### 5.8 Sign out

A plain dialog (option 5): title "Sign out?"; body for a passkey account "Your passkey logs you back in. Your
balance stays with the account. Mining stops." (the last sentence only while mining); for backed-up words
"Your 12 words log you back in. Your balance stays with the account."; for words not backed up the primary
becomes **Back up my 12 words** with "Your 12 words are the only way back in, and they are not backed up yet.
Yacana keeps no copy." and "sign out anyway" only after the backup. Buttons **Sign out** (danger) · **Cancel**.
The same dialog answers "Use a different account" on the Welcome screen.

### 5.9 The upgrade and the old origin

**Levels.** Level 0: the header tag `V6 · Sep 18`. Level 1: the card on Mine and Wallet. Level 2: the dialog's
stages. Level 3: `/faq#rules`.

**Announced (on V5, before the upgrade)** — the card: eyebrow `aztec v6 · expected around sep 18`; title
"Aztec upgrades to V6 around Sep 18."; body "Mining continues here until then. Send your balance ahead when
you're ready: V5 proves it out, it's held on Ethereum for V6, and you claim it on V6 with one tap. After the
upgrade V5 keeps proving for a while, then stops without notice; send ahead before it does." Button **Send
ahead**; quiet "How it works".

**After a send** — the card: title "3.5 tYACA sent ahead."; body "Held on Ethereum for V6 once V5 proves it;
you claim it on V6 with one tap. Wins mined since then stay here until you send them too."; the trail; then
"1.2 tYACA mined since" with **Send 1.2 tYACA ahead** once something was mined.

**Send ahead dialog** — title "Send ahead to V6". Amount `3.50 tYACA · MAX`, "balance 3.5 tYACA" (the whole
balance by default; the amount is shown once). Rows: "Leaves V5 · usually within the hour"; "Then · held on
Ethereum; Yacana forwards it into V6 (or you do, from V6)"; "On V6 · you claim it, one tap"; "Visible on
Ethereum · the amount, not the account". Button **Send 3.5 tYACA ahead**. Quiet "How it works".
Sent: ✓ Proved and sent · block 83,120 → ● Reaching Ethereum · by 14:03 (in 40 min) — "If V5 misses it, the
balance comes back here." → ○ Held on Ethereum for V6 → ○ Forwarded into V6 — "By Yacana once V6 opens, or by
you from V6." → ○ You claim it on V6 · one tap. Footer "You can close this. Wallet follows it here, and on V6
once you log in there." **Done**; quiet "Save a recovery file" with "a recovery file lets another device pick
this send up". Nothing is clickable but Done while it proves. V6 is "expected" in every sentence before the
flip: the portal forwards to the canonical registered later version, which need not be V6.

**The last day, four readings** (the portal's `deadline()`): before the upgrade, "for at least 180 days after
the upgrade; after that, until the upgrade after V6 lands"; after it, "until at least Mar 17 (180 days after
the upgrade); after that day, until the upgrade after V6 lands"; once the upgrade after V6 is scheduled before
Mar 17, the date is final ("until Mar 17", later only by paused seconds); past Mar 17 with none scheduled, the
row turns red, `could close any day` · "The 180 days are over. V5's exits close the day the upgrade after V6
lands. Claim it now." (the portal records that upgrade in the first call that sees it and closes V5 in that
same block: a cliff, never a future date). "Later if the next upgrade comes later" is gone: it read as time
gained.

**How it works** (level 2): the five stages with their times — "Reaches Ethereum with its epoch · usually
within the hour · V5 must prove the epoch within its deadline, about 40 min after the send (the real time once
it is in a block). If it doesn't, the balance comes back here." — "Forwarded into V6 · by Yacana, or by you ·
Yacana runs a relayer (an address its multisig lists) that forwards held sends once V6 opens. You can forward
yours from V6 with an Ethereum wallet paying gas. Forwarding ends the option below." — and the note "If V6
never opens, or Yacana is late: this account can redeem it on Ethereum as YACA instead, for at least 180 days
after the upgrade; after that, until the upgrade after V6 lands. A pause or the exit limit can delay it."

**The Wallet row** — `3.5 tYACA → V6` · `held for V6` · "Held on Ethereum for V6, out of V5's reach. Yacana
forwards it into V6 once V6 opens; you can too, from V6." + "Or redeem it on Ethereum as YACA, until at least
Mar 17 (…)". Six hours after V6 opened with nothing forwarded: `longer than usual` · "Yacana hasn't forwarded
it yet. Forward it yourself from V6, or check the Ethereum RPC in Settings." (the clock starts when V6 opens,
not when the send was held: a send held three days before the upgrade is not "longer than usual" on day one;
§9.1.12). V6 live but unregistered:
`waiting for Yacana` · "V6 is live, but Yacana hasn't opened its contract there yet. You can redeem it on
Ethereum meanwhile." **Redeem on Ethereum**. Board AheadRows draws the six rows to "claimed".

**Upgraded but not announced (the "bet" case, #24)** — the card: eyebrow `aztec v6 is live · sep 18 14:02`;
title "Mining has ended on V5. Send what's left ahead."; body "V5 keeps proving for a while after an upgrade,
then stops without notice. A send it proves is held on Ethereum for V6; one it never proves comes back here;
what's still here when it stops can't leave."; the live chip `V5 proved an epoch 12 min ago` (ok) / `no proof
from V5 for 3 h` (warn) / `V5 stopped proving · Sep 21` (bad, only once the stop is recorded). Button **Send
3.5 tYACA ahead**. The chip's source is a blueprint item (§9.3): the page must record when the proven
checkpoint last moved.

**v5.yacana.network** (option 7) — `/` serves the app, not the landing. Header: `Yacana V5 · retired` · **Send
ahead** · Stats ↗ (the apex) · the account chip (→ Settings) · gear. The page: eyebrow `aztec v5 · retired · sep
18`; title "Send what's still here ahead."; body "Mining moved to V6 at yacana.network. Your balance can still
leave while V5 keeps proving, and V5 can stop at any time: send it ahead to V6 now, or bridge it to Ethereum.";
the live chip. Card "Still on V5" · `private · can leave while V5 proves` · `3.5 tYACA` · **Send ahead to V6** ·
quiet "or bridge to Ethereum" · "Then claim it on V6 with one tap, at yacana.network. Same passkey." The
activity rows below. Advanced: recovery file · restore (no "forward it myself": forwarding happens on V6).
Silent (no proof for hours): the chip amber and the body "V5 hasn't proved an epoch for 3 hours and may have
stopped. A send it never proves comes back here; one it proves is held on Ethereum for V6." Signed out: "Log in
to see what's still here." **Log in** (the Log in screen with the restore note). Quiet (V5 stopped proving, a
few days after the flip; the last day is months later and is a row state, not a page state): the chip `V5
stopped proving · Sep 21`; title "V5 has stopped proving. Nothing more can leave."; body "What V5 proved in
time is on V6, or held on Ethereum for V6, redeemable until at least Mar 17. What was still here when it
stopped can no longer leave."; the card `1.2 tYACA · cannot leave · Left here when V5 stopped proving.`; the
held row stays (it can still be forwarded or redeemed). Tabs: Send ahead, Settings, Stats ↗. No Wallet tab, no
landing, no mining, no deposits. The activity's second row sends at 14:12 with its deadline at 14:52. Node gone
(the runbook retires V5's node long before the last day; board OldOriginGone): the chip `V5's node has shut
down`; title "V5's node has shut down. Nothing more can leave from here."; body "What V5 proved in time is on
V6, or held on Ethereum for V6: see it at yacana.network. A device that never held a send restores its
recovery file there."; the card "Logging in here needed V5's node, and it is gone." **Open yacana.network**. No
log in, no Change node: the page has nothing to read.

**V6, first login** — the Wallet row `3.5 tYACA from V5` · `ready to claim` · "Arrived from V5. Claim it into
your balance: one tap, about 20 s, no fee." **Claim**. Before the forward: `held for V6` on V6 too, with
**Forward to V6** (Rabby pays the gas) beside "Yacana forwards it…". The balance tile's Send and Bridge to
Ethereum wake up once something is in the balance, and say so.

### 5.10 Navigation (option 4)

Desktop header: `[Yacana V5]` (link → the app's home) · **Mine** · **Wallet** · **Stats ↗** · **Verify ↗** …
`testnet` (neutral) · the status pill · the account chip (`0x22a9…612a`, → Wallet; → Settings on the old
origin) · the gear (Settings). Icons at 14 px beside the labels. Stats and Verify open the stats app in a new
tab (mining lives in this tab; the ↗ says so). On the stats app: **Stats** · **Bridge** · **Verify** · **Mine
↗**. Phone: a bottom bar with four icon+label items (Mine, Wallet with its badge, Stats ↗, Settings); Verify
is a tab inside Stats there; the account chip in the top bar. The "V5" tag stays by the logo. "testnet · fees
sponsored" → `testnet`; sponsorship is said where a fee would be expected ("no fee · Yacana sponsors it").

## 6. The copy deck (before → after)

The full deck is the CopyDeck board (41 rows). The rows that changed in v2:

| Where | Before | After |
|---|---|---|
| Sign-in | Keep the passkey synced… it opens this account on every device | Keep it in a password manager that syncs and it opens this account on the devices that manager syncs to. Lose every copy and the account is lost; Yacana can't recover it. |
| Sign-in | (one error for everything) | six notes: dismissed or timed out · can't make a Yacana passkey · no passkeys in this browser · sign-in didn't complete (no passkey here, or dismissed) · this device can't open a Yacana passkey · another tab has it open: close it, then retry |
| Sign-in | passkey · synced | passkey |
| Opening | Preparing the prover | Preparing your miner |
| Mine | escape hatch · if it closed now | anyone can close it · next bar if it closed now |
| Mine | ✓ claim in block 83,164 · 4 tYACA minted | ★ a win · claiming, about 20 s → ✓ minted in block 83,164 ↗ · 4 tYACA, privately |
| Mine | (Presto silently falls back) | ✦ Presto stopped answering. Proving in the browser meanwhile · Retry when it's back |
| Header | testnet (amber) | testnet (neutral) |
| Wallet | mining claims · 12 | wins · 12 |
| Wallet | (a disabled button, no reason) | Deposits into V5 are closed for good. Bridge from Ethereum on V6, at yacana.network, once it opens. / The Ethereum RPC isn't answering: bridging waits until it does. |
| Wallet | Send (a two-step sheet) | Send to an account. · Privately \| Publicly · Fee: none · Yacana sponsors it · Send 1 tYACA privately |
| Rows | proved › proven to Ethereum › claim on Ethereum | sent › block 83,131 › reached Ethereum › claim on Ethereum |
| Rows | proving to Ethereum | reaching Ethereum (the chip and the trail say the same word) |
| Rows | (no sentence for six states) | checking · didn't finish · not included · waiting for the limit · over the limit · last day passed · waiting for Yacana · longer than usual · arriving on V6 |
| Rows | claimed | claimed · final once its epoch is proven, usually within the hour |
| To Ethereum | Arrives · about an hour | Arrives · usually within the hour; then you claim it there |
| To Ethereum | Proven to Ethereum (the active step) | Reaching Ethereum · usually within the hour. V5 must prove it by 17:03. If it doesn't, the balance comes back here. |
| To Ethereum | (a pasted address, no second look) | the full address · pasted · not your connected wallet · Check every character. A bridge can't be recalled. |
| Claim | To · Rabby 0x90F7…b906 · Gas · paid by your wallet | To · 0x90F7…b906 · chosen when you bridged · Paid by · Rabby, in Sepolia ETH / Rabby is on Ethereum mainnet: Switch Rabby to Sepolia / Rabby rejected it. Nothing was claimed. |
| From Ethereum | (no closed state) | Deposits into V5 are closed for good. Aztec upgrades around Sep 18 and Yacana closed V5's deposits ahead of it. |
| Send ahead | Leaves V5 · within the hour · Lands on V6 · when you log in there, one tap | Leaves V5 · usually within the hour · Then · held on Ethereum; Yacana forwards it into V6 (or you do, from V6) · On V6 · you claim it, one tap |
| Send ahead | Whole balance by default (a helper) | balance 3.5 tYACA |
| Send ahead | Held for V6 → Lands on V6 when you log in | Held on Ethereum for V6 → Forwarded into V6 · by Yacana once V6 opens, or by you from V6 → You claim it on V6 |
| Send ahead | Yacana's relayer forwards it | Yacana forwards it (the relayer defined once, in How it works) |
| Send ahead | Any time before V5's last day (Mar 12) | until at least Mar 17 (180 days after the upgrade; later if the bridge pauses or the next upgrade comes later) |
| Upgrade | Your balance stays yours… lands on V6 the first time you log in there… then stops for good | Mining continues here until then. Send your balance ahead when you're ready: V5 proves it out, it's held on Ethereum for V6, and you claim it on V6 with one tap. After the upgrade V5 keeps proving for a while, then stops without notice; send ahead before it does. |
| Upgrade | V5 proving ✓ · last proof 12 min ago | V5 proved an epoch 12 min ago / no proof from V5 for 3 h / V5 stopped proving · Sep 21 |
| Old origin | Move out (the tab) | Send ahead |
| Old origin | Your balance is safe here while V5 keeps proving | Your balance can still leave while V5 keeps proving, and V5 can stop at any time: send it ahead to V6 now, or bridge it to Ethereum. |
| Old origin | Sends proven in time are safe… What was still here is gone. | V5 has stopped proving. Nothing more can leave. What V5 proved in time is on V6, or held on Ethereum for V6, redeemable until at least Mar 17. What was still here when it stopped can no longer leave. |
| Old origin | advanced · forward it myself | (removed; forwarding happens on V6) |
| Settings | off: one touch per open · on: sealed under a device key | On: anyone who can use this browser could open and spend from this account without your passkey. Off: one touch per open. |
| Settings | (the row goes quiet) | no answer for 2 min · your view is from 14:02 · mining paused · Retry / answering slowly · rate-limited |

## 7. The options the owner picks

| # | Question | A (recommended) | B | C |
|---|---|---|---|---|
| 1 | Arrival on /mine | **Page-first**: the live cockpit with Start mining; the dialog opens on the click; a stored account gets the lock screen. | Dialog-first (today's), redesigned. | An onboarding route `/mine/start` (Bazaar's page) with "Just watch" to the cockpit. |
| 2 | The transaction container | **Centred dialog** (440 px) → a bottom sheet on the phone that scrolls, the keyboard pushing the button up; form → progress → done. | The right-side sheet, redesigned. | A full page per flow (`/mine/wallet/bridge`). |
| 3 | Bridge form | **One screen** with the live summary; the button carries the amount; a pasted address shows in full with its tag. | Two steps, the review compact (3 rows). | — |
| 4 | Navigation | **Text + 14 px icons**, a gear, an account chip; phone bottom bar with 4 icon+label items, the badge on the item. | Text-only tabs, unified across apps. | An icon rail on the left (desktop). |
| 5 | Sign out | **A confirm dialog** (with the backup gate). | Hold-to-confirm restyled (mono progress under the label, 1.2 s). | — |
| 6 | Power with Presto | **The Presto row replaces the slider**; the slider returns when Presto drops out. | The slider dimmed with a one-liner. | Hide the slider, no row; the pill's ✦ is the only sign. |
| 7 | The old origin | **One "Send ahead" page + Settings (with Account) + Stats ↗.** | Keep a Wallet tab too. | — |
| 8 | Passkey consent | **Keep the one checkbox**, unchecked, the button disabled until ticked; friction on purpose, not proof. | Drop it; the note carries the fact and the words flow has its own confirm-by-typing. | — |

## 8. Progressive disclosure and safety during upgrades

The uncertain moments are three: the days before an upgrade, the hours after it (V5 still proving), and the
"stopped proving" end. The rule: at level 1 say the fact, the next step, and the one consequence of not acting;
at level 2 the stages with times and who does what; at level 3 the contract. Never a bet, never "safe": a
proven send is on Ethereum, held for this account, and still needs forwarding or redeeming before V5's last
day; a balance on V5 can lose its way out at any time; the copy says exactly that much and no more. The last
day itself has four readings (§5.9), and the only one that promises a date is the one where the portal has it. The live chip (`V5 proved an epoch 12 min ago`) does the reassuring because it is
true and it updates; silence reads as silence (`no proof from V5 for 3 h`, amber), and "stopped" appears only
once the stop is recorded. The deadline is a time and a countdown beside the step it governs, once it exists;
the outcome of missing it is a fact in plain words ("the balance comes back here"). The last day is "at least
Mar 17 (…)" until the contract sets it, because it can only move later. The forward is a step the user can
see, with who does it; the relayer is defined once, in How it works, with the consequence of forwarding (no
redeem afterwards). Redeem-on-Ethereum lives under the row's sentence and in Details, never in the headline.

## 9. What the blueprint carries

### 9.1 Defects (fix regardless of the design)

1. Two account records can coexist (`keys/store.ts`, `WelcomeBack` lists all); existing double records
   survive until one is signed out (the single slot is decision 9.2.12).
2. The opening bar: `notes` is indeterminate and weighted 15 while it is the long stage; the weights should
   follow measured durations, and the sync should report blocks if the PXE exposes them.
3. The chart's `−3 min` before any sample; the bar step and the win mark share one x mapping and the mark's
   drop line covers the step.
4. Deposits (`kind === 3`) are filtered out of `BridgeTile`; a `dropped` deposit renders nowhere; the
   ArrivalCard's per-row `from(c)` lacks the canonical argument.
5. `AmountInput`: unit and MAX chip on different baselines.
6. `Stepper` pending titles `text-ink-4` while details are `text-ink-2`.
7. `SendAheadSheet`'s "some of it →" never disabled; `nextVersion()` falls back to the string "the next
   version" inside `V${…}`.
8. The logo is a `<span>` in the miner and stats apps.
9. The old origin serves the landing at `/` and keeps the full tab bar.
10. A `proving` record that survives a reload without a hash: the session recovers the hash by the send's log
    tag (`session.ts` `txByTag`, read when `!c.txHash`), but a send that never reached the chain returns
    nothing and the record stays `proving` for ever (`afterTx` returns on `!f.tx`). Show "checking" while the
    tag has no log; expire into "didn't finish" only once the transaction's own expiry has passed with no log.
11. `ChainViewHeldError` has no takeover: the other tab's connection must close (`wallet.ts:99`); the dialog
    offers Retry, never "Continue here".
12. `takingLong` (`bridge/copy.ts`) counts from the record's `updatedAt`, the moment it entered `held`, which
    before the flip is when it was witnessed: a send held days before the upgrade reads "longer than usual"
    while V6 does not exist (`TakingLongDialog` has the same bug). The clock starts at the later of held-at and
    V6's `VersionRegistered`, and runs only while `canonicalRegistered`.
13. A "didn't finish" row stays re-adoptable by its tag: a log found later moves it on, never a final state.

### 9.2 Design decisions the code must follow

1. The cockpit never dims (`data-signed-out` opacity/saturate removed); Start mining carries its intent.
2. The transaction dialog replaces the right-side sheet (option 2 A) and the two-step bridge (option 3 A).
3. The activity row replaces JournalCard + ArrivalCard, with the state table of §5.4 as its copy source
   (`bridge/copy.ts` rewritten to it) and the trail vocabulary of §4.3.
4. A disabled money button carries its reason (`rpcFailing`, `depositsClosed`, unregistered, paused).
5. The claim dialog runs `ensureChain` as a visible step and names the payer and the fixed recipient.
6. The Send flow is one screen; the unknown-recipient probe runs on blur, inline.
7. The node row keeps reporting (last block age, silent, throttled); the switch is a stepper.
8. "Use a different account" routes through the Sign out dialog.
9. The old origin's tab is "Send ahead"; its Settings has Account; no forward action there.
10. The mining ledger says "claiming" between ★ and ✓; wins are "wins".
11. `OldTabNotice` copy stays; it is a redeploy guard, not this pass.
12. One account per browser: a single slot with fail-closed create/login and `excludeCredentials`.
13. Presto is probed at Start mining, not at cockpit-ready (`boot.ts:159`).
14. The pause never disables a money button; the row says the claim waits. `deposit` needs the version
    registered and deposits not closed; `forward` and `redeem` need the bridge open (not paused, within the
    limit, before the last day).
15. The claim dialog maps the portal's revert names from the ABI (`WaitsForHeadroom`, `VersionPaused`,
    `DeadlinePassed`) to the row's sentences.
16. The old origin's opening never offers Change node; with V5's node gone it shows the "node gone" page.
17. The chips are one word per state everywhere: "reaching Ethereum", "arriving", "could close any day".

### 9.3 Capabilities the design needs and the app lacks

1. **The proving chip's source.** "V5 proved an epoch 12 min ago" takes its time from Ethereum: the block
   timestamp of the rollup's last proof-verified event, read through the Ethereum RPC (never the moment this
   page noticed the checkpoint move, which proves nothing about when Ethereum received the proof); "no proof
   for 3 h" is that timestamp aged; "stopped" is the runbook's recorded stop (§9.3.9), never the deadline.
2. **The forward step.** `held` → `forwarded` is read today; the row needs the "longer than usual" clock
   (`takingLong`, 6 h) surfaced as a row state, not a dialog.
3. **The claim's settlement.** `claimSettled` drives "final once its epoch is proven" and the pruned-claim
   re-offer sentence; the mining ledger's ✓ needs the same signal.
4. **The deadline's four readings.** `deadline()` is `max` until both transitions are recorded; when the
   version after next is observed after the floor, the observation itself is the deadline (`_sync` writes
   `block.timestamp`), so V5 closes in that block. The page reads `flipAt`, `afterNextAt` and `pausedSeconds`:
   no flip → "for at least 180 days after the upgrade"; flip, no after-next, before the floor → "until at least
   <flip + 180 d>; after that day, until the upgrade after V6 lands"; after-next before the floor → the date,
   final but for paused seconds; past the floor with no after-next → `could close any day`. A shown date is
   re-read at every refresh (an `unpause` refunds unused seconds).
8. **The payer's ETH.** The claim dialog needs the connected wallet's Sepolia ETH balance (and a gas estimate)
   before asking the wallet, so "no ETH for the gas" is a state, not the wallet's own error.
9. **The stopped-proving record.** "V5 stopped proving · Sep 21" needs the runbook's recorded stop (or the
   chip's age past a threshold the operator sets); the page never infers a stop from one silent hour.
   `docs/upgrades.md` has no such step today: the blueprint adds one, or the age rule.
10. **The old origin's "node gone" page** needs the page to tell "V5's node is retired" from "no answer for
    2 min": a served flag in the record (the runbook's node-retirement step), not a timeout.
5. **Presto's fallback row**: the SDK's `FallbackReason` and the invalid-proof cause, one line each, with
   Retry; the pill follows what proved.
6. **The recovery file's prompt** after a send-ahead (the runbook's device-that-never-held-it case). The file
   carries the record and whatever the journal knows at save time; a restore re-reads the chain and the
   served witness archive, so a file saved before the proof still completes, and the page offers to save it
   again once the witness is known.
7. **Whether the PXE's burn/claim/send-ahead proofs could run through Presto** is a question for the SDK,
   not this pass; the stepper says "in your browser" until then.
