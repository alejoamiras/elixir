---
plan: yacana-second-pass
tier: mid
driver: claude-code
code_review: off
eli5_mode: artifact
budget: recon 1 agent · code-review off · codex high fix loops until clean, hard stop 3 rounds per arc · a final cross-arc pass
created: 2026-09-07
---

# yacana-second-pass — the three surfaces, second pass

The first two passes shipped the design system and the binder's frames. Looking at the live site, the owner found
every block carrying the same weight (an eyebrow, a heading, a body and a widget in one tile, at one size), a landing
that argues only in words, a hero chart that apologises for itself, a miner whose loop parks the bar on the floor and
whose claim moves the whole cockpit, and an account called "your key". This plan applies the owner's picks from the
design canvas: a shorter landing whose only chart lives in the hero tile, a stats page with one lead chart, a calmer
cockpit whose claim lives in the rail, one Send sheet, Sign out, and the vocabulary and links the pages were missing.

Design source of truth: the design canvas **Yacana Second Pass Screens**
(https://claude.ai/code/artifact/3c4599e1-2c0f-4ce6-8334-0be09c5ef369, fourteen artboards; its generators live in the
authoring session's scratchpad, and every measurement the implementation needs is copied into this plan). Recon:
`recon.md`.

## Success criterion

Each surface matches its canvas artboard at 1280 and 1440 px in composition, copy and hierarchy (deviations listed in
`lessons/` with the reason); the landing ships no prover and no CRS; the landing's ledger shows a verified, linked example claim when the
profile has one recorded and honest dashes when it does not; every address, class id, block and transaction
the pages show opens on the explorer; no user-facing string calls the account a key; every existing gate passes with
its assertions updated to the new screens; the stats screenshot baselines are regenerated once and hold; each arc
converges in its codex loop; three stacked PRs.

## Owner's answers (Phase 0)

- Picks (from three canvas rounds): landing **A, diet in place** with hero **H2 plus** and the Live row removed;
  Verify retitled **"See for yourself."** with only "Read the source"; the in-page demo and "Prove one now"
  **removed entirely**; stats **A**; cockpit **A2** (calm loop) with claim **B** (a reserved slot in the rail);
  pop-out **A**; send sheet **A** with the public option as the withdraw; sign out **A** (hold to confirm); the
  wallet page shows one account and Sign out only; sign-out lands on the sign-up screen.
- Validation layers: lint + typecheck + `bun test` always; Vitest component specs on every component phase;
  Playwright E2E on the isolated network at each arc boundary; the stats screenshot gate for the stats arc. The
  assembled-site E2E is not required (the site arc runs it once anyway because `_headers`/`build.json` are untouched
  and the check is cheap).
- `code_review`: **off**.
- Delivery: **three stacked PRs** (ui + miner → stats → landing + site).
- Hardening: none scheduled. The pass adds no trust boundary; the explorer links are outbound `rel="noopener"`
  anchors and the CSP does not change.
- Audit outcomes the owner should know (details in the Decision ledger): the senders card **stays**, reworded and
  demoted, because a private transfer between two Yacana accounts is only discoverable after the recipient registers
  the sender; the landing's ledger shows **one recorded example claim**, labelled as such, because public storage
  holds no hashes; the poll stays at **30 s** on the shared testnet node; the sign-out dialog carries the **back-up
  path** for a words account that never confirmed its words.

## The canvas, measured (the spec)

Tokens and primitives are unchanged (`packages/ui/src/theme.css`; `Tile` `px-[18px] py-4 rounded-[8px]`,
`TileHeader` mono 11 px uppercase with a normal-case aside, `Kpi` md 22 px / lg 40 px, buttons 38 / 30 / 48 px).

**Landing (`LandingA`, 1440 × ≈2400).** Bar: brand · Money · Chain · How · Verify · env pill · Stats · "Mine on
testnet" (uv, sm). Hero `grid-cols-[1fr_1.1fr] gap-[30px] px-9 pt-14 pb-11 items-center`: left the headline (50 px,
two sentences on two lines), the subhead "Proof-of-work money on Aztec, mined in your browser: earned by anyone,
private to everyone." (19 px), two `lg` buttons **Mine on testnet** (uv) and **Watch the stats**, the 12.5 px
reassurance line (unchanged copy); right a tile `align-self:center; padding: 14px 18px; gap: 10px` holding a row
(`StatusPill mining` "live from the chain" · "block 73,164 · 3 s ago" 11 px), a 2 × 2 grid of `Kpi` md
(`minted 444 tYACA` "111 claims · by browsers", `epoch 29 2 of 4` "open 5 min · expected 5", `bar 3.3` "what a proof
has to clear", `network ≈ 0.05 proofs/s` "median of 6 epochs"), a rule, a 96–104 px chart (the bar per epoch as a
step line over the last six epochs on log₂ with ticks 1 · 4 · 16 · 64, one dot per accepted claim spread evenly across
its epoch, "epoch 29 · open · 2 of 4" top right), its caption "the bar over the last six epochs · a dot per accepted
claim, spread across its epoch" (11 px mono), and the line "4 claims close an epoch, then the bar moves · all stats →".
Money `grid-cols-[1fr_1.25fr]`: eyebrow, heading "Nobody prints it. Nobody sees who has it.", lede "4 tYACA per
accepted proof, 4 claims every five minutes, forever. No premine, no admin key, no special hardware." left; the
comparison table right, six rows, header Bitcoin · Zcash · **tYACA** (violet), the YACA column violet and every other
cell `ink-2`. The rules `<dl>` is gone. Chain `grid-cols-2`: heading "Public: that a coin was mined. Private: the notes
and the transfers.", the 15 px paragraph "A claim writes a nullifier, a note hash and a counter. Not the recipient,
not the secret, not how many proofs it took. A public withdraw shows its amount and address, which is why it is a
choice." left; right the **ledger**, two flat tiles side by side: "public · one claim, as recorded" (aside "block N ↗", the
example's block) with `KvRow`s a nullifier / a note hash (both linked to the example's `/tx-effects/<hash>`) / claims
in epoch N `a → b` (the example's epoch and counter, never today's) / fee paid by "the sponsor", and a dashed "private
· never on the chain" with who claimed ("— · a first claim carries Aztec's delivery handshake, which someone who
already knows that address can match") / how much they hold / how many proofs it took / who they pay, and how much,
each "—". Without a recorded example the public tile shows the row labels with "—" and no block chip. How: eyebrow, heading "Prove. Score. Claim.", the three tiles with the existing copy. Verify
`grid-cols-[1fr_1.25fr]`: heading **"See for yourself."**, paragraph "The contracts are immutable, the verifier key is
pinned inside the claim circuit, and every number on this page is read or derived from public storage. Each address
below opens on the explorer."; right the chips (miner · token · class linked to the explorer; W vk and launched not;
source linked to the commit on GitHub via `REPO`)
and one button **Read the source**. Ask and the footer unchanged. The Live section, `Demo.tsx`, "Prove one now" and
the mobile share fallback's demo copy are removed; the mobile hero keeps "Send me the link" and "Watch the stats".

**Stats (`StatsA`, 1440 × ≈1880).** The six KPI tiles keep their labels with one-line subs: minted "111 claims × 4 ·
no premine"; epoch N "of 4 claims" with a 12 px ring (progress toward the expected five minutes, amber past the escape
hatch) before "open 5:12 · expected 5:00" counting each second; difficulty "×0.83 at the last close"; claims / hour
"an estimate from epoch counts"; network with the calculator link; the sixth becomes **since you opened** `+3 claims`
"12 tYACA minted · 6 min" (counts from the tab's first successful poll; a reload starts over). Row 2 unchanged (the strip `span 4`, the epoch
card `span 2`; the epoch card's "open for" counts each second). Row 3: **difficulty**, `span 6`, `border-line-2`, aside
"per epoch, log scale · 30 epochs", the chart 200 px with the escape-hatch closes as amber dashed rules labelled
"escape hatch closed epoch N · ÷4" (a rule in the right 30 % labels to its left), the open epoch haloed, x ticks every
third epoch, the last tick "29 · open". Row 4: three tiles in one row (`grid-cols-3`), 110 px each: emission "against
the schedule" (ticks 0 · 5k · 10k, x `+N h`), epoch duration "amber = the escape hatch" (rules "expected 5 min" right
and "20 min · anyone may close it after this" left, ticks 10 s · 1000 s · 1 d), retarget at each close "violet harder · grey easier" (×0.25 · ×1 ·
×4). Row 5: the table, aside "30 of 30 · newest first · CSV · JSON", body `max-h-[460px] overflow-y-auto`, `thead`
sticky, "closed by" says **the escape hatch** instead of `roll()`, the "load older" control inside the scroll, a
footnote "↕ scrolls · header stays · load older at the bottom". Row 6 unchanged. Titles "Yacana · Stats" / "Yacana ·
Verify"; the favicon is the mark.

**Miner cockpit (`MinerA2`, 1440 × ≈1000).** Bar: brand · Mine · Wallet · **Stats ↗** · Settings · env pill · status
pill. Grid unchanged (`1fr 1fr 1fr 300px`, gap 14). Loop tile `col-span-3`: a 34 px status row ("LIVE · LAST 3 MIN"
left; "6.1 s per proof · 11 threads · 342 proofs · 3 wins" and Stop right), the canvas 230 px in **calm** mode: no
gridlines, the baseline at score 1 (`line`, labelled "1"), the bar as the only line (uv, 2 px, labelled by its value
on the axis and "the bar · clear it to win" above it at the right), proofs under the bar as 2 px `ink-3` ticks at
55 % opacity from the baseline to their score, wins as the existing ringed dot with "★ 5.2 · a win" beside them, the
window three minutes, labels "−3 min" / "now"; the axis top `max(2.5 × bar, best-in-view × 1.25)` on log. No legend
under the canvas. The rail column (`row-span-2`) is a `flex-col gap-[14px]` of the **claim slot** and the epoch tile:
idle, a dashed tile `padding: 12px 14px; text-align:center` ("CLAIM" label, "no claim in flight"); mid-claim, a
`border-uv` tile headed "claim · epoch 29" (aside "won 18:46:13") with the three rows proved (✓, seconds) / sent
(●, seconds) / minted; on the mint, "✓ 4 tYACA minted · block 73,201 ↗" for ten seconds, then idle again. The epoch
tile is unchanged. KPI row unchanged except the third sub "3 wins · 12 tYACA this session". Ledger: the ✓ line reads
"claim in block 73,164 ↗ · 4 tYACA minted, privately · effects ↗" (block → `/blocks/N`, effects → `/tx-effects/<hash>`).
The **balance** tile: header "balance" aside "private", the amount at `Kpi lg` with no label, **Send** (primary) and
"Wallet →" (ghost), a chip `account 0x282d…c274 ↗` (`/address/<addr>`), "3 claims this session". Receive is gone.
Top-right pill: mining / claiming / minted as today.

**Pop-out (`PopOutA`, 360 × 190).** `bg-ground p-3 flex-col justify-between`: row 1 the mark + `StatusPill` and Stop
(sm); row 2 a 48 px strip of the last 60 s (the bar at 20 px as the only line, proofs as 2.5 px dots, one win ringed);
row 3 `9.8 proofs/min` (19 px) · `epoch 29 · 2 of 4 · bar 3.3` (mono 11) · `3 wins · 12 tYACA` (mono 11, ok).

**Send (`SendSheetA`, `SendReviewPublic`, `SendSent`, 448 wide).** Title **Send**, sub "From this account's private
balance of 48.00 tYACA."; the amount field 36 px mono with the unit and a `max` chip; a "To" field; two full-width
radio cards **Privately** "The recipient gets notes. Nothing about this transfer is public." (default) and **Publicly**
"Withdraws to a public balance. The amount and the address are readable by anyone."; **Review** (primary) with "Mining
pauses while the transfer is proved in your browser." Review: label "send · step 2 of 2", the amount with the mode,
`KvRow`s to / from ("this account's private balance · 48.00 → 40.00") / fee ("paid by the sponsor"), the amber card
**This will be public.** for the public mode (the existing unknown-recipient card for private), **Send publicly** /
**Send privately** and Back. Sent: "Sent.", the amount with "✓ in block N", to / how / transaction (linked) / balance
now, **Done**, "Mining resumed.".

**Sign out (`SignOutA`, 480 wide) and the wallet page (`WalletAfter`).** Dialog "Sign out of this account?", sub
"0x282d…c274 · 48.00 tYACA stays on the chain, with the account.", a note tile by recovery method (passkey: "Your
passkey signs you back in." / "It is saved on this device and any synced devices, so there is nothing to write down.";
words: "Make sure your twelve words are saved." / "They are the only way back into this account; Yacana keeps no
copy."), **Hold to sign out** (danger; the fill sweeps for 1.2 s and the action commits when the pointer or key is
*released* after the fill completed, so a release before completion cancels) and Cancel; a text link under the
buttons, **"Can't hold? Sign out with a click"**, always present, swaps the hold button for a plain **Sign out** button
that commits on click; both paths call the same `signOut()` which re-checks eligibility. A words account not backed up
shows **Back up the twelve words** (opens the existing backup flow, returns to the dialog) in place of both. Wallet page: tile **balance** (Kpi lg,
"12 claims · nothing about this balance is public", Send, the linked account chip with "copy"); tile **account** (one
row: address ↗, "passkey · stays open on this device", Sign out; the note "Signing out returns to the sign-in
screen. Your passkey signs you back in; the balance stays with the account."); tile **claims from this device** `col-span-2`,
aside "N · newest first", `max-h-[280px] overflow-y-auto`, rows `date time · epoch N · block N ↗`; under the balance
tile, a compact **senders** row (label "expecting a private transfer from another Yacana account?", the sentence "Add
their address so this account can find their notes.", the input and Add; test ids unchanged). Gone: "keys on this
device" with its list and links, Receive, the recovery line (its "back up now" moves into the sign-out dialog and the
account tile: "twelve words · not backed up · Back up now" on a words account).

**Sign-up (`SignUp`).** First run: "Sign up with a passkey." (40 px), "Your account lives in a passkey on this
device, synced where your platform syncs passkeys. Your balance follows the account, not the browser; nothing is
written down. Lose every copy of the passkey and the balance is lost with it.",
**Sign up with a passkey** (uv, lg) and the link "I have twelve words". A returning device keeps "Welcome back." with
its known accounts and the same three ways in, worded with "account".

## Architecture & Implementation

**Explorer links (`packages/site`, `packages/ui`).** `packages/site/site.env` gains `EXPLORER_URL=https://testnet.aztecscan.xyz`;
`config.ts` carries it as `SiteConfig.explorerUrl` (e2e/dev override `VITE_EXPLORER_URL`; the literal `off` means
no links, so the existing `||` fallback in `pick` keeps its meaning) and `viteDefine` exposes `VITE_EXPLORER_URL`. A pure module `packages/site/src/browser/explorer.ts` builds the five URL
kinds (`instance(addr)`, `classVersion(id, v = 1)`, `address(addr)`, `block(n)`, `tx(hash)`): it validates its input
(`0x` + 64 hex for addresses, class ids and hashes; a safe positive integer for blocks and class versions) so a lying
node cannot shape a path, `encodeURIComponent`s, returns `undefined` when the base is `off` or the input invalid (the
caller then renders plain text), and is covered by a `bun test`; `assertProductionConfig` parses the base with
`new URL` and requires `https:`. **`Chip` is untouched** (it stays a copy button, and its DOM must be byte-identical through
arc 1 because `web-stats.yml`'s visual job runs on any `packages/ui/**` change and its baselines only regenerate in
arc 2). The link is one component, `ExplorerLink({href, full, children})` in `packages/site/src/browser/explorer.tsx`
(`packages/site/tsconfig.json` and the root `tsconfig.json` gain `"jsx": "react-jsx"` and the site's `typecheck`
script joins `TC1`; today neither config compiles `.tsx`):
an `<a target="_blank" rel="noopener noreferrer" title={full}>` with an `aria-hidden` ↗ and an sr-only "opens the
explorer", used inline in `KvRow` values, ledger lines and the freshness pill, and inside a chip-styled span (with a
sibling copy button) where a chip is wanted. The short form is passed in by the caller (`shortAddress` for addresses,
`shortHash` for hashes; no third helper). Every render site in recon's table gets its link; the landing's `source`
chip links `REPO` from `copy.ts`, not the explorer. The claim's `txHash` (already in `Minted` and
`ClaimProgress`) reaches the ledger through a new optional `links?: {block?: string; tx?: string}` on the `minted`
`ProofLine`; `ProofLedger` renders them as anchors when present (its `chain` string stays for the text), so the
generic component knows about URLs, not about the explorer. Mainnet later: the profile's `site.env`
value changes, nothing else.

**Favicon and titles (`packages/site`, the three `index.html`).** `vite-base.ts` adds a `transformIndexHtml` step that
injects `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml,…">` from `markSvg('idle')`
(`packages/ui/src/mark.ts`) into every app; the miner's `applyTabStatus` keeps replacing it at runtime. Titles:
`web-stats/index.html` "Yacana · Stats", the Verify route sets `document.title = 'Yacana · Verify'` on entry (and back
on leave); `web-landing/index.html` unchanged; the miner's `tabTitle()` unchanged.

**Design-system additions (`packages/ui`).** `hooks/use-tweened-number.ts` (`useTweenedNumber(value, {ms = 300})`,
ease-out-cubic like `rise()`, returns the target immediately under reduced motion or a hidden document);
`components/hold-button.tsx` (`HoldButton onConfirm holdMs=1200 disabled`): the hold runs on pointer capture; the
fill completes on the timer and `onConfirm` fires on the *release* that follows completion (an early release,
`pointercancel`, `pointerleave`, blur, `visibilitychange` to hidden, unmount or a `disabled` change cancels), so the
commit is a completed gesture the user can still abort, per WCAG 2.5.2's up-event rule; keyboard holds Space or Enter
with `event.repeat` ignored and commits on keyup; progress is a `role="progressbar"` child with `aria-valuenow`
(never `aria-pressed`), the hint "hold, then release" via `aria-describedby`; the fill is a CSS transform. The
component does not decide eligibility: the caller's `onConfirm` does, and callers must offer a plain-click alternative
(the sign-out dialog's "Can't hold?" link). `components/radio-cards.tsx` on Radix
`RadioGroup` (the installed `radix-ui`). No `Segmented full` (no consumer once the radio cards exist). The stats
`thead` gets `sticky top-0 bg-raised` on a table switched to `border-separate border-spacing-0` (collapsed borders
do not travel with a sticky header), inside the existing wrapper which becomes `max-h-[460px] overflow-auto` (one
scrollport). `ScoreLoop` gains `calm?: boolean` and a `geometry` (`pad`, `fontPx`) so the pop-out's 48 px strip has a
plot area: in calm mode `drawCalmGrid` draws only the baseline, `drawCalmBar` labels the axis value and the right-hand
caption, `drawCalmDots` draws ticks for ordinary proofs and the ringed dot plus label for wins (separate functions:
`drawDots` stays under the cognitive budget), the top of the log axis is `axisTop(difficulty, samples) = max(2.5 ×
difficulty, 1.25 × max(scores))` from the model, `spanMs` defaults to 180 000 in calm mode; `flash()` on a win stays;
the component takes `win?: Window` so the pop-out animates and pauses on its own document. `mark.ts` is
unchanged; `Chip` and `KvRow` are the link carriers.

**Miner (`packages/web-miner`).** `LoopTile` loses the stepper and `MintedMarks` mounts (the `NoticeCard` for the
non-claim notices `prover-dead` / `offline` / `paused` stays under the loop, where it is today), keeps the header row
as a fixed-height status row whose right side is the readouts (`proofsPerMinute`, threads, the session's proof and win
counts from `miner.ledger`/`claimsAtom`) and Stop; `RailTile` becomes a column: the new `features/ClaimSlot.tsx`
(`min-h-[72px]`; precedence: a claim notice `reverted` / `expired` / `failed` > the stepper > the ✓ line for ten
seconds from `minted.at` > idle; a new claim replaces the ✓) above the epoch tile. Reducer changes this needs:
`Minted.at` recorded by `claimed`; neither `attempt` nor `startJob` clears `minted` any more (the controller calls
`start()` right after `claimed`, `controller.ts:482`, so the automatic restart would otherwise erase the
acknowledgement before its ten seconds); `minted` is replaced only by the next `claimed` or cleared by the next
`winner` event (a new claim in flight; `submit` is the command it emits, not an event), and every consumer applies the
same ten-second freshness from `minted.at`: the slot hides it, and `pillStatus` (`lib/status.ts:8`, which today reports
`minted` whenever the miner is idle and the field exists) reports `minted` only while it is fresh, so a stop long
after a claim shows `idle`, not a stale `minted`. The reducer test drives claimed → start → attempt → (10 s) → stale →
stop, and claimed → winner → replaced. `SAMPLE_SPAN_MS` 60 000 → 180 000 (about thirty samples at six seconds a proof); the renderer filters the
samples by its own window before drawing and before `axisTop`, so the pop-out's 60 s strip and the tile's 180 s window
each see their own set, and `axisTop` of an empty set is `2.5 × difficulty`. `WalletCard` → `BalanceCard`
(balance, Send opens `SendSheet`, "Wallet →", the linked account chip, the session count). `WithdrawSheet` →
`SendSheet` (`Draft.mode` unchanged, `RadioCards` for the mode, the amount field first with `max` at full precision
(`amount(balance, DECIMALS, DECIMALS)`, not the four-place display form), the review step and the sent step per the
spec; the sent step renders the reviewed snapshot; "Mining resumed." reads `miner.phase`; `session.withdraw` returns
`{block, txHash}` from the same receipt it already awaits (`chain.ts:155-156`), keeping the "a balance refresh failure
cannot fail a sent transfer" guarantee). Wallet route: `BalanceTile`, `AccountTile` (the open record, its method, "Back
up now" for a words account not backed up, `SignOutDialog`), the compact `Senders` row (kept: `registerSender` is how
the recipient's PXE finds a new sender's notes), `ClaimsHistory` capped and linked; `Receive`, `KeysOnDevice` and its
three links are deleted. `SignOutDialog` (`ui` `Dialog` + `HoldButton`): the note by `record.method`; one `signOut()` that re-reads the
record and refuses when `method === 'words' && !backedUp` (the UI already shows "Back up the twelve words" in that
state, opening `WordsBackup` and returning); the hold button and the "Can't hold? Sign out with a click" plain button
both call it; confirm → `session.forget(record)` (reloads to `KeyScreen`: the sign-up screen when no record remains,
Welcome back otherwise).
`KeyScreen`: first run heading "Sign up with a passkey.", the copy per the spec, the returning state keeps its list
with "account" wording. App nav gains `Stats ↗` (`appHref('stats')`). Settings: the About tile loses the `<details>`
diagnostics; `ConnectionCard` gains "Copy diagnostics (shortened)": the last 200 `logAtom` lines, capped at 16 KB total, each
line capped at 400 characters, every `0x` hex run longer than 40 characters shortened to `0x1234…abcd`, every URL's
userinfo and query stripped (`new URL` → origin + pathname); an inline error when the clipboard call is rejected; a
one-line caveat that the log names this account's claims and the node. It is a shortened log, not a proof that error
text holds no secrets; `components/LogCard.tsx` is deleted. `pip.ts`: the font failure is diagnosed before it is fixed (P1.2 opens the pop-out under Playwright, in both the
standalone build at base `/` and the assembled build at `/mine/`, and reads the failed font requests from
`performance.getEntriesByType('resource')` and the console, under the shipped headers: the CSP's `base-uri 'none'`
rules out a `<base>` element, so the candidate fixes are copying the page's `<link rel="stylesheet">` elements instead
of `cssText`, or rewriting each `@font-face` `url()` to an absolute URL against the sheet's `href` before copying; the
inline styles Radix and Sonner inject must keep being copied either way); `bg-bg` → `bg-ground`; `PipView` becomes
the 360 × 190 layout with a `ScoreLoop calm height={48} geometry={{pad: 4, fontPx: 10}} spanMs={60_000} win={pip}`
strip.
Rate, per-proof seconds and balance readouts go through `useTweenedNumber` (display values only: the send form and
every transaction input read the store's bigint; the hook clocks on rAF timestamps and cancels its frame on unmount). The rename: every string in recon's
inventory where "key" means the account becomes "account" (test ids unchanged; "twelve words", "passkey", "proving
keys", "verifier key", "device key" untouched); `miner-core/src/claim-failure.ts:31,35` included.

**Stats (`packages/web-stats`).** `Stats.tsx`: the difficulty `ChartTile` moves to its own `span 6` row with
`HEIGHT = 200`, the other three into a `grid-cols-3` row at 110 px (the chart height becomes a prop of `Chart`);
`specs.ts`: the duration rule label "20 min · anyone may close it after this" (short form "20 min" under 420 px), the
difficulty roll labels "escape hatch closed epoch N · ÷4" anchored left of the rule when it sits in the right 30 %,
the last numeric x tick suppressed within 60 px of "N · open", y ticks 1 · 4 · 16 · 64 on the lead chart; `Table.tsx`:
the scroll container, sticky head, "the escape hatch" wording, the load-older control inside; `Observatory.tsx`: subs
cut to one line, the ring in the epoch tile (`stroke-dasharray` on a 12 px circle from `openedAt` and the expected
seconds, amber past `escapeHatchIn ≤ 0`), the sixth tile fed by a `sinceOpenedAtom` (the first successful poll's
`{claims, minted, at}`); `Detail.tsx`: "open for" formatted `m:ss` from `nowAtom`; `metrics.ts:135`: the `rolled`
sentence says "past the 20-minute mark" and "the escape hatch"; `main.tsx`: `POLL_MS` stays 30 000 (the node is the
shared testnet RPC; the second-by-second cues below come from the local clock, not from polling); `Freshness` links the
block and pulses its dot 240 ms on a new block number (a `data-block` attribute keyed animation, reduced-motion
aware); numbers through `useTweenedNumber`, which settles within 300 ms of a change (the visual spec's `setFixedTime` freezes
wall time, not timers or rAF, so the capture waits for an explicit settled signal: the page sets
`data-settled="1"` on `<main>` once every tween is at rest, and the visual spec waits for it before the screenshot); `Observatory.tsx` and
`Stats.tsx` sit near the 80-line budget already, so the ring becomes `EpochRing.tsx`, the sixth tile
`SinceOpened.tsx`, and the chart rows a `ChartRows.tsx`. Charts stay on Observable Plot inside web-stats; nothing moves to
`packages/ui` (the landing's hero chart is one small SVG, below).

**Landing (`packages/web-landing`).** `copy.ts`: `SECTIONS` drops `live`; the bar anchors drop Live; the money rules
list, the chain `holding` paragraph and footprint, the demo strings and the verify buttons other than "Read the source"
are deleted; the new hero, chain, verify and money strings are added. `Hero.tsx` renders `HeroLive` (the tile: pill +
freshness, the 2 × 2 `Kpi` grid from `live`, the chart, the caption, the stats line) instead of `Demo`; the mobile
branch keeps share + stats. `sections/BarChart.tsx`: a small SVG built from the same `EpochRow[]` the strip used
(`HISTORY` stays 12, the chart draws the last six closed plus the open one; dots per row = `claims`, spread at
`(k + 0.5) / claims` across the epoch's width; log₂ y over the rows' targets; no Plot). `Money.tsx` keeps the table
(two tones, `TONE` reduced to violet for the last column), `Chain.tsx` renders the ledger as **one recorded claim**: public
storage keeps counts and a digest per epoch, not nullifiers or note hashes, and no deployment step ever claims
(`deploy.ts:93-186` deploys, binds and launches), so the values come from a committed file
`deployments/<profile>.example-claim.json` (`{miner, chainId, rollupVersion, epoch, claims: [a, b], block, txHash,
nullifier, noteHash}`), written by `packages/deploy/scripts/record-example-claim.ts <txHash>` from the transaction's
own effect: the script requires, in `effect.publicDataWrites`, a write to this deployment's `claims[e]` **public-data leaf**
(`computePublicDataTreeLeafSlot(miner, deriveStorageSlotInMap(claimsSlot, e))`, exactly as `live.test.ts:212-221`
derives it; the value is `b`, and `a = b - 1` because a claim increments by one) and a write to the `last_digest[e]`
leaf whose value, siloed through `ticketNullifier(digest, miner)` (`miner-core/src/proof.ts:52-53`), is a nullifier
present in the effect; it takes that nullifier and the first note hash, and refuses any transaction that lacks the
writes (the ticket search is by value, as `controller.ts:90-98` does; no positional fallback). A captured effect from
the live test's deployment is committed as a fixture so the extraction is unit-tested without a node, beside the
optional live test. The
file is bound to the deployment by `miner`/`chainId`/`rollupVersion`, and `loadSiteConfig` rejects a file whose
identity differs from the profile's record. The owner runs the script once against testnet with a claim from the soak
(a real-data `describe.skipIf(!AZTEC_NODE_URL)` test covers it). The site config exposes the file as
`VITE_EXAMPLE_CLAIM` (absent → the tile shows "—" and no block chip; the isolated E2E asserts that rendering, since
its throwaway deployment has no claim, and a second e2e build with a fixture file asserts the populated state). All
values are one transaction's; the block chip links `/blocks/N`, the hashes `/tx-effects/<txHash>`, `Verify.tsx` the new title, paragraph, linked chips and one button. Removed: `src/demo/`,
`sections/{Demo,Live}.tsx`, the demo wiring in `App.tsx`/`hooks.ts`/`state.ts`, `web-miner/src/demo/` (nothing else
imports it), `scripts/prebuild.ts`'s CRS and artifact steps (it keeps `copySlots`), `prover: true` in
`vite.config.ts`, `@aztec/bb.js` and `@aztec/noir-noir_js` from the package (`bun.lock` updated), the three demo globs
in `web-landing.yml`, the "Prove one now" mention in `docs/deployments.md:100`, the OG card's copy if it names the
demo (it does not; unchanged). `og.html` unchanged.

**Data & control flow.** The landing's hero reads the same `watchChain` stream as before (open epoch, rows, block);
the ledger's example claim is build-time data from the example-claim file. The miner's claim slot subscribes to the same atoms `LoopTile`
did. The stats' "since you opened" derives from the first poll's totals in memory; a reload resets it, by design.
Explorer URLs are computed at render from the `define`d base; no fetch.

**File-level change map.** `packages/site`: `site.env`, `src/config.ts` (`explorerUrl`, `exampleClaim`, the production https check),
`src/vite-base.ts`, `src/browser/explorer.ts` + `explorer.tsx` (+ `explorer.test.ts`), `e2e/site.e2e.ts` (the demo
test becomes "the landing serves no prover; the miner still does"), `docs/deployments.md`. `packages/deploy`:
`scripts/record-example-claim.ts` (+ its skipIf test). `deployments/testnet.example-claim.json` (owner-run). `packages/ui`: `hooks/use-tweened-number.ts`,
`components/{hold-button,radio-cards}.tsx`, `score-loop.tsx`, `score-loop-model.ts`,
`index.ts`, specs. `packages/web-miner`: `App.tsx`, `features/{LoopTile,RailTile,ClaimSlot,SendSheet,SignOutDialog,
KeyScreen,WordsScreens,ClaimStatus}.tsx`, `components/{BalanceCard,ConnectionCard}.tsx` (delete `WalletCard`,
`LogCard`), `routes/{Wallet,Settings}.tsx`, `session.ts`, `chain.ts` (withdraw returns the tx hash), `controller.ts`,
`boot.ts`, `wallet.ts`, `lib/reducer.ts`, `pip.ts`, `tab-status.ts`, specs, `e2e/{withdraw,words,passkey}.e2e.ts`,
delete `src/demo/`. `packages/miner-core`: `src/claim-failure.ts`, `src/metrics.ts`. `packages/web-stats`:
`routes/{Stats,Verify}.tsx`, `features/{Observatory,Detail,Table,Strip,EpochRing,SinceOpened,ChartRows}.tsx`, `charts/{plot,specs,index}.tsx`,
`App.tsx`, `main.tsx`, `state.ts`, `index.html`, `stats.vitest.tsx`, `e2e/__screenshots__/*`. `packages/web-landing`:
`copy.ts`, `App.tsx`, `hooks.ts`, `state.ts`, `sections/{Hero,Money,Chain,Verify,Bar,HeroLive,BarChart}.tsx`
(delete `Demo`, `Live`), `scripts/prebuild.ts`, `vite.config.ts`, `package.json`, `sections.vitest.tsx`,
`e2e/landing.e2e.ts`, `.github/workflows/web-landing.yml`.

**Trade-offs and alternatives not taken.** (1) Moving Plot into `packages/ui` for the hero chart: rejected; one
step-line SVG is 40 lines and the landing stays free of d3. (2) A static `favicon.svg` copied by `assemble.ts`:
rejected in favour of the injected data URL, which also serves the standalone dev/preview servers and needs no CSP
change (`img-src data:` exists). (3) Keeping the withdraw as a second sheet: rejected; one sheet with the public
option is the owner's pick and removes a route. (4) Claim slot as a fixed status line in the loop tile (the canvas's
option A): rejected by the owner for the rail slot. (5) A `sinceOpened` persisted in `sessionStorage`: rejected; a
reload starting the count over is honest. (6) Building the hold gesture on a library: rejected; 40 lines on pointer
events and a timer, tested. (7) `Chip href`: rejected after both audits; a button typed as a button cannot grow an
anchor without lying, and any `Chip` DOM change in arc 1 breaks the stats visual gate before arc 2 regenerates its
baselines. (8) Removing sender registration: rejected; without it a private transfer between two Yacana accounts is
undiscoverable by the recipient. (9) A 15 s poll: rejected; the local clock supplies the liveness cues and the testnet
RPC is shared. (10) The example claim inside `deployments/<profile>.json`: rejected; a miner's transaction is not
part of the deployer's identity record, and mixing it with the live counter fabricated an event.

## Phases

Arcs are surfaces so each PR is one reviewable slice; the shared `packages/ui` and `packages/site` work rides with the
first arc that needs it.

### Arc 1 · ui + miner (`second-pass-miner`)

`TC1 = bun run --cwd packages/ui typecheck && bun run --cwd packages/web-miner typecheck && bun run --cwd packages/web-stats typecheck && bun run --cwd packages/web-landing typecheck && bun run --cwd packages/site typecheck && bun run typecheck`
(the root `typecheck` excludes the app and ui sources, `tsconfig.json:21-26`; the per-package scripts are what CI runs).

**P1.1 ✓ Explorer links, favicon, tween, hold, radio cards (packages/site + packages/ui).** `explorer.ts` (validation,
encoding, `off`) + `bun test`; `explorer.tsx` `ExplorerLink`; `site.env` / `config.ts` (`explorerUrl`, the production
https check in `assertProductionConfig`) / `vite-base.ts` (`VITE_EXPLORER_URL`, the icon injection); `useTweenedNumber`
(+ a Vitest spec with fake rAF: tweens to the target, returns the target under reduced motion, cancels on unmount);
`HoldButton` (+ spec: no confirm at timer expiry while still held; exactly one confirm on the release that follows a
completed fill; a release before completion, `pointercancel`, `pointerleave`, blur, hidden, unmount or `disabled`
cancels; keyboard hold with `repeat` ignored and confirm on keyup; the progressbar's `aria-valuenow`); `RadioCards` (+ spec); the
`ScoreLoop calm` mode, `geometry` and `win` props, `axisTop` in the model (+ a `score-loop-model.test.ts` case).
`Chip` and `Segmented` untouched.
Validation gate: `bun run lint && TC1 && bun test packages/site packages/ui && bun run --cwd packages/ui
test:components` exit 0; `git diff --stat main -- packages/ui/src/components/chip.tsx packages/ui/src/components/segmented.tsx`
empty (the stats visual job runs on this PR against the old baselines). Layers: lint/typecheck · unit · component.

**P1.2 The cockpit: calm loop, claim slot, balance card, nav, tweens, pop-out.** Reducer: `Minted.at`, `attempt` and `startJob` keep
`minted`, `winner` clears it, `SAMPLE_SPAN_MS = 180_000`, `pillStatus` takes `now` and the ten-second freshness
(+ `bun test` cases: claimed → start → attempt keeps `minted`; claimed → winner replaces it; the pill is `minted` at
5 s and `idle` at 11 s after a stop; samples older than 180 s drop; `axisTop` on an empty window); `LoopTile` status row + `calm` (non-claim notices stay under the loop); `ClaimSlot`
in `RailTile`'s column with the precedence and `min-h-[72px]`; `BalanceCard` with Send and the linked chip; `Stats ↗`;
the tweened readouts; the ledger's linked ✓ line (`chain` carries block + tx); the pop-out: diagnose the font
failure under Playwright first (log the failed URLs in `lessons/phase-1.md`), then apply the first candidate fix under
which the pop-out's `document.fonts` contains a loaded `FontFace` for "Hanken Grotesk Variable" and its font resource
requests succeed (`fonts.check` alone can be true for a face that never loaded); `bg-ground`; `PipView` 360 × 190
with the 48 px strip. `cockpit.vitest.tsx` updated (the rail column holds the slot then the epoch tile; the loop tile
has no stepper); a spec for `ClaimSlot`'s four states and the ten-second expiry (fake timers are forbidden by the
dual-runner rule, so the spec passes `now` in).
Validation gate: `bun run lint && TC1 && bun run --cwd packages/web-miner test:components && bun test
packages/web-miner` exit 0. Layers: lint/typecheck · unit · component.

**P1.3 Send, Sign out, the wallet page, sign-up copy, the rename, Settings.** `SendSheet` (three steps, `RadioCards`,
`max` at full precision, the snapshot through the sent step, `withdraw` returns `{block, txHash}`); `SignOutDialog` +
`HoldButton` + the plain confirm + the "Back up the twelve words" path; Wallet route (`BalanceTile`, `AccountTile` with
"Back up now", the compact `Senders` row, capped linked `ClaimsHistory`; delete Receive, `KeysOnDevice`, the recovery
tile); `KeyScreen` / `WordsScreens` copy; the rename across the inventory (`claim-failure.ts` included); About without
diagnostics, "Copy diagnostics" (bounded, shortened) on the network card, `LogCard` deleted. `forms.vitest.tsx` and
`shell.vitest.tsx` updated; a spec for `SignOutDialog` (passkey note, words note, the back-up path when not backed up on both the hold and the
click path, the "Can't hold?" link swapping in the plain button, exactly one `forget` per confirmation). The rename guard: `scripts/rename-guard.test.ts` gains a second check over
`packages/web-miner/src` and `packages/miner-core/src` for `\bkeys?\b` in JSX text and in the string literals of
user-facing copy only, with an allowlist of the compounds that stay (`passkey`, `proving keys`, `verifier key`,
`device key`, `admin key`, `spend key`) and an explicit exemption list of persistent and protocol strings that must
never change: `DB_NAME = 'yacana-keys'`, the AAD prefix `yacana-key:` (`keys/store.ts:27,108`), WebAuthn's
`'public-key'` (`keys/passkey.ts:17`), import paths under `keys/`, and `data-testid` values. Renaming any of those
would strand accounts or break sign-in; the guard exists to catch copy, not to encourage compatibility-breaking
fixes. It runs in `miner-core.yml` on every PR.
Validation gate: `bun run lint && TC1 && bun test packages/web-miner packages/miner-core scripts && bun run --cwd
packages/web-miner test:components` exit 0 (the guard is part of `bun test scripts`). Layers: lint/typecheck · unit ·
component.

**P1.4 Miner E2E on the isolated network.** `withdraw.e2e.ts` drives the three-step Send (private to a registered
sender, then public with the amber card), keeps the recipient's private-balance and public-balance assertions, asserts
the sent step's tx link href; `words.e2e.ts` replaces "forget" with the sign-out dialog (hold via `mouse.down` +
`waitForTimeout(1300)` + `mouse.up`; a second case releases at 600 ms and asserts nothing happened; a third uses the
"Can't hold?" click path), asserts a not-backed-up words account is offered "Back up the twelve words" on both paths
and can sign out after the backup, that the last account's sign-out lands on the sign-up screen and a remaining account's
on Welcome back; `passkey.e2e.ts` asserts the account tile and the linked address; `miner.e2e.ts` asserts the claim
slot fills during a claim, the loop tile's `boundingBox().height` is unchanged before, during and after, the ✓ line's
block link, and the pop-out's fonts (a loaded `FontFace` in the pop-out's `document.fonts` and no failed font resource).
Validation gate: `bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` exit 0 (production build). Layers:
e2e-isolated (run locally; CI's `e2e.yml` is dispatch-only). Arc boundary: the codex loop, then `gh stack add
second-pass-stats`.

### Arc 2 · stats (`second-pass-stats`)

**P2.1 The observatory: lead chart, small multiples, table, words, live cues, titles.** `Stats.tsx` rows via
`ChartRows.tsx`; `plot.tsx` height prop; `specs.ts` labels and ticks; `Table.tsx` scroll + sticky (`border-separate`) +
wording; `Observatory.tsx` subs, `EpochRing.tsx`, `SinceOpened.tsx`; `Detail.tsx` `m:ss`; `metrics.ts` sentence;
`Freshness` link + pulse; the tweens; titles; `stats.vitest.tsx` updated (the grid test: the difficulty tile alone in
its row, three small tiles in the next; the table's container classes; the wording; the ring's presence; "since you
opened" from a second poll). Biome's budgets hold without suppressions.
Validation gate: `bun run lint && TC1 && bun test packages/miner-core packages/web-stats && bun run --cwd
packages/web-stats test:components` exit 0. Layers: lint/typecheck · unit · component.

**P2.2 Screenshot gate and E2E.** Regenerate `e2e/__screenshots__/stats-{390,1024,1280,1440}.png` inside the pinned
Playwright image (the fidelity lessons' documented path; `PLAYWRIGHT_VISUAL_IN_IMAGE=1` is set only inside the image),
commit them with the code; the live E2E asserts the linked block in the freshness pill; the table's overflow, the sticky header (scroll
the wrapper, assert `scrollTop > 0` and the header's `boundingBox().y` unchanged) and the escape-hatch wording are
asserted against a replayed fixture, since the live isolated deployment has one epoch. Today's recording holds nine
epochs (`visual.e2e.ts:56`, `visual-setup.ts:68`), which neither overflows 460 px nor closes by the escape hatch, so
P2.2 first re-records `visual-rpc.json` with the documented `record` step over a soak-produced history of at least
twenty epochs including one escape-hatch close (the slot table's chunk 0 covers them; the replay's row-count
expectation and the screenshot baselines are regenerated from the same recording); the visual and the scroll/wording
assertions then share one fixture.
Validation gate: `bun run --cwd packages/web-stats test:visual` exit 0 in the image (no diff) and `bun run e2e:agent --
bun run --cwd packages/web-stats test:e2e` exit 0. Layers: e2e-isolated (screenshot gate included). Arc boundary: the
codex loop, then `gh stack add second-pass-landing`.

### Arc 3 · landing + site (`second-pass-landing`)

**P3.1 The landing: hero tile with the bar chart, the diet, the ledger, Verify, the demo removed.** `copy.ts`;
`HeroLive` + `BarChart`; `Money` two tones; `Chain` ledger from `VITE_EXAMPLE_CLAIM` (present → the recorded claim
with its links; absent → "—"); `packages/deploy/scripts/record-example-claim.ts` (+ a unit test on a committed captured effect, and a
`describe.skipIf(!AZTEC_NODE_URL)` test on a real testnet claim); the owner runs the script once with a soak claim's tx hash to produce
`deployments/testnet.example-claim.json` before this arc's E2E (Ask 1); `Verify`; delete the demo (both `demo/`
directories, `Demo.tsx`, `Live.tsx`, the wiring, `prebuild.ts`'s CRS and artifact steps, `prover: true`, the two deps,
the workflow globs, the docs line, the `site.e2e.ts` demo test, replaced by "the landing serves no prover; the miner
still does"); `sections.vitest.tsx` updated (six sections, the hero tile's four KPIs and chart, the ledger's rows in
both states, Verify's one button, no `demo-*` ids).
Validation gate: `bun run lint && bun run lint:actions && TC1 && bun test packages/web-landing packages/site
packages/deploy && bun run --cwd packages/web-landing test:components && bun install --frozen-lockfile && bun run
--cwd packages/web-landing build && ! grep -rlE "barretenberg|bb\.js|\.wasm" packages/web-landing/dist/assets` exit 0
(the built landing carries no prover; the lockfile diff reviewed for unrelated version moves and recorded in
`lessons/phase-3.md`). Layers: lint/typecheck · unit · component.

**P3.2 Landing E2E and the assembled site.** `landing.e2e.ts`: the section order (six), the hero tile reading the
chain (`live-*` ids move into the tile), no bb.js, WASM or CRS request at any point (`net.heavy` empty for the whole
visit), the ledger's "—" state (the isolated deployment has no claim), then a second e2e build and server with
`VITE_EXAMPLE_CLAIM` pointed at `e2e/fixtures/example-claim.json` (bound to the e2e deployment's identity by the
setup, which rewrites the identity fields) asserting the linked block and hashes; both runs are mandatory in
`test:e2e`; Verify's chips' hrefs; the assembled site E2E confirms `/crs` still
serves (the miner) and the landing's HTML and assets reference none of it.
Validation gate: `bun run e2e:agent -- bun run --cwd packages/web-landing test:e2e` and `bun run e2e:agent -- bun run
site:e2e` exit 0. Layers: e2e-isolated. Arc boundary: the codex loop, then the final cross-arc pass.

## Validation layers

lint/typecheck (Biome, the per-package `typecheck` scripts plus the root's) · unit (`bun test`) · component (Vitest +
RTL, `*.vitest.tsx`) · e2e-isolated (Playwright on the isolated local network through `bun run e2e:agent`, run locally
at arc boundaries since CI's `e2e.yml` is dispatch-only; the stats screenshot gate in the pinned image is a PR gate).
No testnet layer: nothing here touches chain behaviour; the one real-data test (`record-example-claim`) is skipIf.

## Security & Adversarial Considerations

- **Threat model.** The pages are static; the miner holds a vault. The new surface is outbound links to a third-party
  explorer, a clipboard write, a hold gesture on a destructive action, and the removal of a prover from the landing.
- **Explorer links.** `rel="noopener noreferrer"` on every link (COOP `same-origin` already severs `opener`; the
  attribute is belt and braces) and `Referrer-Policy: no-referrer` stays. The base URL comes from the committed
  `site.env`, never from the query string or the node; e2e/dev overrides are ignored in production by
  `loadSiteConfig`, and `assertProductionConfig` refuses a non-https base. The builder validates every identifier
  (`0x` + 64 hex; a positive integer block) and encodes it, so a lying node can at most point at a wrong-but-well-formed
  explorer page. Clicking a link tells the explorer which account or transaction the visitor looked at; that is
  inherent to an explorer link and the ↗ makes the hop visible. The CSP is unchanged: an anchor is not a fetch.
- **Sign out.** The hold gesture prevents an accidental click: the fill must complete while held and the action
  commits on the release that follows, so an early release, a leave, a blur, a hidden document or unmount aborts it
  (WCAG 2.5.2: the up-event completes, and completion is abortable). A plain-click path is always reachable ("Can't
  hold? Sign out with a click"), so switch and auto-scan users are not locked out. Both paths run one `signOut()` that
  re-checks eligibility: a words account that never confirmed its backup is routed to the backup flow instead of
  signing out, because signing out drops the sealed entropy from this device. The dialog states what stays (the balance, with the account)
  and what is needed to return. `session.forget` is unchanged. This is weaker than today's typed last-four check by
  design (the owner's pick); the hold plus the backup gate keeps the irreversible case guarded.
- **Send.** The public option shows the amber consequence card before the button, and the button's label carries the
  mode. The snapshot-then-send flow is unchanged, so a re-render cannot change what is sent.
- **Clipboard.** "Copy diagnostics" writes at most 16 KB: the last 200 log lines, each cut at 400 characters, long
  hex shortened, URL credentials and queries stripped. The log holds status text and error messages, never key material
  (the vault does not log), but it names this account's claims (tx hashes, blocks) and the chosen node, so the button
  says so. Clipboard rejection is shown, not swallowed.
- **Removed attack surface.** The landing no longer loads bb.js, the work circuit or the CRS, so a visitor's CPU is
  never used without a click into the miner; the landing's own chunks shrink (the miner still ships the prover, so
  the assembled site does not).
- **Supply chain.** Two dependencies removed from `web-landing`; none added anywhere (`RadioGroup` is in the
  installed `radix-ui`). `bun.lock` committed; CI installs frozen; the lockfile diff is reviewed for unrelated version
  moves at P3.1 (removing a landing dependency must not move a package the miner still needs).
- **Analytics beacon.** Cloudflare's dashboard-injected Web Analytics is blocked by the CSP today; the owner turns it
  off in the dashboard (the footer promises no trackers). No CSP relaxation.
- **Delivery.** `gh stack sync` rebases and force-pushes in one step, so it is not used; the order everywhere is
  `gh stack rebase` → the fast gates → `gh stack push`, never push first. The agent owns every arc branch; the moment anyone else pushes to one, syncing
  stops and the owner is asked.

## Assumptions

**Facts**
- `SiteConfig` has no explorer field and `viteDefine` is the one path to the browser (`packages/site/src/config.ts`);
  `pick` falls back on `||` (`config.ts:81`), hence the literal `off`.
- `Chip` is a `<button>` typed `ComponentProps<'button'>` that copies on click (`packages/ui/src/components/chip.tsx:6-34`);
  `shortHash` and `shortAddress` coexist (`ui/marks.tsx:4`, `site/src/browser/format.ts:37`).
- `web-stats.yml`'s `visual` job runs on `packages/ui/**` changes with zero-tolerance baselines that only arc 2
  regenerates: arc 1 must not change any DOM the stats page renders.
- No `<link rel="icon">` in any `index.html`; `vite-base.ts` has no HTML transform; `img-src data:` is in the CSP.
- `Minted` and `ClaimProgress` carry `txHash`; nothing renders it (`web-miner/src/lib/reducer.ts:20-42`, `ClaimStatus.tsx`).
- `attempt` nulls `minted` on every proof (`reducer.ts:169`); the controller restarts mining right after `claimed`
  (`controller.ts:482`); `SAMPLE_SPAN_MS = 60_000` (`reducer.ts:130`); `NoticeCard` also carries `prover-dead` /
  `offline` / `paused` (`reducer.ts:44`).
- `ScoreLoop` uses a fixed 1–1000 axis and `pad` 24 (`score-loop-model.ts:12`, `score-loop.tsx:144`).
- `MasterRecord.method` is `'passkey' | 'words'` and `backedUp` exists (`web-miner/src/keys/store.ts:11-25`); passkeys
  are discoverable (`keys/passkey.ts:63`), so a signed-out passkey account can sign back in.
- `session.forget(record)` reloads when the open record is dropped (`session.ts:222-226`); `KeyScreen` shows Welcome
  back when any record remains and the first-run screen otherwise (`KeyScreen.tsx:237-241`).
- A recipient's PXE finds a sender's notes only after `registerSender` (`session.ts:229-232`); `withdraw.e2e.ts:22-34`
  registers the sender before the private transfer.
- The only "back up now" entry is the wallet's recovery tile (`Wallet.tsx:12-35,216`; `words.e2e.ts:71`).
- Nothing in `web-miner/src` imports `src/demo/` besides the landing (`grep -rn "demo/" packages/web-miner/src`).
- `web-landing`'s `prebuild.ts` runs `fetch-crs` and `copy-artifacts` itself; `assemble.ts` runs them for the whole
  site (`packages/web-landing/scripts/prebuild.ts:1-11`, `packages/site/src/assemble.ts:59-77`); `site.e2e.ts:71-79`
  proves the demo on the assembled origin.
- Public storage keeps, per epoch, the params, the claim count and the last ticket digest, plus the open epoch
  (`packages/contracts/yacana_miner/src/main.nr:56-68`, `miner-core/fixtures/storage-layout.json`): no claim times, no
  nullifiers, no note hashes. The deploy script deploys, binds and launches; it never claims (`deploy.ts:93-186`); the
  isolated E2E deployment (`web-landing/e2e/run-setup.ts:85`) has no claim either.
- A claim's effect carries the miner's public data writes as public-data-tree leaves (`computePublicDataTreeLeafSlot`
  over the map-derived slots, `live.test.ts:212-221`) and the ticket nullifier **siloed by the miner contract**
  (`ticketNullifier(digest, miner)`, `proof.ts:52-53`); `controller.ts:90-98` finds it by value (index 1 is only its
  fallback).
- `sendWithdraw` (`web-miner/src/chain.ts:155-156`) awaits `call.send({wait})` and reads `receipt.blockNumber`; the
  same receipt carries `txHash`.
- The miner's standalone build has base `/` (`web-miner/vite.config.ts` passes none; `vite-base.ts:104` defaults) and
  the assembled build `/mine/`; `pip.ts:12-20` copies `cssText` into the pop-out; the CSP sets `base-uri 'none'`
  (`headers.ts:30`). The cause of the missing fonts is not established.
- `amount()` truncates to four places (`format.ts:30`).
- `radix-ui@^1.6.7` ships `RadioGroup` (`node_modules/radix-ui/dist/radio-group.*`).
- The root `typecheck` excludes `packages/{ui,web-miner,web-stats,web-landing}/src` (`tsconfig.json:21-26`); CI runs the
  per-package `typecheck` scripts.
- The visual spec fixes the clock with `page.clock` (`visual.e2e.ts:13,54`) and compares with zero tolerance inside the
  pinned Playwright image (`web-stats.yml` `visual` job); CI's `e2e.yml` is dispatch-only.
- aztecscan's paths were verified live on 2026-09-07 for the testnet miner instance
  (`/contracts/instances/<addr>`, `/contracts/classes/<id>/versions/1`, `/address/<addr>`, `/blocks/<n>`,
  `/tx-effects/<hash>`).

**Inferences**
- One of the two pop-out font fixes (copying the `<link>` elements, or absolutising the `@font-face` URLs) makes the
  fonts load; P1.2 diagnoses first, in both builds, and records the failed URLs, so the fix is chosen on evidence.
- `position: sticky` on the `thead` works inside the wrapper once the wrapper is the single scrollport and the table
  uses `border-separate`; P2.2 asserts it by scrolling.
- Regenerating the screenshot baselines in the pinned image is a repeatable step (fidelity lessons phase 3).
- The soak produced accepted claims on testnet whose tx hashes the owner can name (the soak report and the miner's
  log carry them).

**Asks**
- **Ask 1 (answered 2026-09-07: "find it"; resolved):** the explorer's public-call index for the miner instance
  lists the claims; the candidate `0x0cc85e677c17cf0d99c45beb71b84f820813db102ed0b0529c1a0203aae1cad5` (block
  73,162) was verified against the testnet node with the plan's own check: its effect writes the `claims[29]` leaf
  with value 2 (so 1 → 2) and the `last_digest[29]` leaf, and carries the siloed ticket nullifier of that digest
  (`0x29b9adff…b62f`) and one note hash (`0x1f31034e…c410`). Arc 3's `record-example-claim.ts` is that probe made
  a script; the owner-run step is gone.

## Decision ledger

**Chosen outline: A (surface arcs).** Both audits: B's "lands first" benefit is void (PRs open only at Delivery and
merge as one stack), and B costs seven E2E suite runs against A's three, two baseline regenerations instead of one,
and cascade-rebase conflicts on `Wallet.tsx` and the landing sections that A never has.

**Adopted from the audits** (both reviews converged on the first five): keep sender registration (a functional
regression, not a UI cut); the example claim as its own file with all values from one transaction, recorded by a
script from a real testnet claim, never from the deploy; per-package `typecheck` in every gate; the reducer changes the
calm loop and the ten-second ✓ need (`Minted.at`, `attempt` keeps `minted`, a 180 s sample span); `Chip` untouched and
a dedicated `ExplorerLink` (a typed button cannot grow an anchor; any `Chip` DOM change breaks the stats visual gate in
arc 1); the hold button's cancel list, keyboard semantics, progressbar role and a plain confirm path; the "back up
first" path inside the sign-out dialog; the wording corrections (the delivery-handshake qualification, "read or
derived", "20 min · anyone may close it after this"); the diagnostics export bounded and shortened; the Send sheet's
snapshot and phase-true copy; the `max` chip at full precision; sticky head on `border-separate` with one scrollport;
tweens on display values clocked by rAF; `Segmented full` dropped; `ClaimSlot` precedence and reserved height with the
non-claim notices staying under the loop; the pop-out font fix diagnosed before chosen; `site.e2e.ts`'s demo test
replaced; a built-asset grep for the prover; the sign-in / sign-up wording split; the passkey-loss disclosure kept; the
`gh stack` rebase → gates → push order; the poll left at 30 s; the rename guard as a test rather than a one-off grep.

**Rejected:** a 15 s poll (shared testnet RPC; the local clock supplies the cues); Plot in `packages/ui` (one SVG);
a static favicon file (the injected data URL serves standalone and assembled builds); a docs-only example claim (the
owner wants a linked, real one; the file form keeps it real and separable); mining a claim in the isolated E2E setup
to populate the ledger (minutes per run for one assertion; the fixture path covers the populated state).

**Unresolved:** none between the reviews. Ask 1 (the example claim's tx hash) is the owner's.

**Fable verdict (round 1): `conditional approve`** with five conditions (the ledger premise, the senders regression,
per-package typecheck, the reducer changes, the `site.e2e.ts` test and the arc-1 `Chip` constraint), all adopted
above. Transcript: `audit-fable.md`. **Codex verdict (round 1): `reject`** with four blocking findings (the same
regression, the backup dead end, the nonexistent deployment claim, incomplete gates), all adopted. **Final fresh-context
codex pass: round 1 `reject`** (four blockers, seventeen findings, all verified and adopted, including the mint
lifecycle across the automatic restart, the rename guard's exemptions, the `<base>`/CSP conflict, the siloed nullifier
and leaf slots); **round 2 (resumed) `conditional approve`** with five conditions, all adopted (the siloed extraction
with a captured-effect test, the re-recorded ≥ 20-epoch visual fixture, ten-second freshness in `pillStatus` and
`winner` as the clearing event, the last `sync` removed, the sign-out specs rewritten). Transcript: `audit-codex.md`.

## Delivery

| arc | branch | phases | stacks on | code_review |
|---|---|---|---|---|
| 1 ui + miner | `worktree-yacana-second-pass` | P1.1–P1.4 | main | off |
| 2 stats | `second-pass-stats` | P2.1–P2.2 | arc 1 | off |
| 3 landing + site | `second-pass-landing` | P3.1–P3.2 | arc 2 | off |

`gh stack init --adopt worktree-yacana-second-pass` at the start (the worktree's branch, off `origin/main` `85cb3fe`,
becomes layer 1; it is not renamed, so the `agent-worktree` manifest row stays true; the PR title comes from the
commits); at each boundary, after the arc's codex loop
converged, `gh stack add <next>`; `gh stack push` for checkpoints (after the fast gates, never before). PRs exist only at Delivery: `gh stack submit --auto
--open`, then `gh pr edit` each body with the gate lines, the codex rounds and 1280/1440 renders beside the canvas
artboard (committed under `implementations-plan/yacana-second-pass/shots/<arc>/`, referenced by raw URL). Every
push, at a boundary or at Delivery, follows the same order: `gh stack rebase` (never `sync`, which pushes as part of
its rebase) → the affected arcs' fast gates → `gh stack push`; then `gh pr checks --watch`. The owner merges (`gh stack
merge`) and deploys (`bun run site:deploy`); the agent never deploys production.

## CI

No new workflows. `web-landing.yml` drops the three demo globs; `web-stats.yml`'s `visual` job compares the
regenerated baselines (and, on arc 1's PR, the old ones: hence `Chip` untouched); `miner-core.yml`'s unfiltered run
covers `claim-failure.ts`, `metrics.ts` and the extended rename guard.

## Post-implementation

Executed by the implementing session from this file. `code_review` is `off`: `/code-review` is NOT run at any point.

0. **Before any push**: `gh stack rebase` first (never `sync`), then the arc's fast gates, then `gh stack push`.
1. **Per arc, at the arc boundary** (all of the arc's phases ✓, before `gh stack add` for the next arc): render the
   surface at 1280 and 1440 with Playwright against the isolated E2E server into `implementations-plan/
   yacana-second-pass/shots/<arc>/`, beside the canvas artboard's PNG export. Send codex (`/codex high`, a NEW session
   per arc) the arc's diff, this plan, `recon.md`, the arc map ("this is arc N of 3; later arcs build X on it"), the
   paths of the renders and the artboard, the fidelity ask ("does the page match the artboard? where it does not, is
   the deviation justified?"), the adversarial ask ("what could go wrong? what would an attacker target? what are we
   trusting that we shouldn't?"), plus the two rules below verbatim. Triage (verify codex's claims against the code and
   the renders), apply the accepted fixes, commit, log the round in `lessons/phase-N.md`, RESUME the same session with
   the fix diff. Repeat until a round yields no new material findings; still churning after 3 rounds → stop and
   surface to the owner.
2. **After all three arcs**: one final cross-arc pass in a FRESH codex session over the net diff from `85cb3fe`,
   asking for seams between arcs (the `Chip`/`LinkedHash`/`useTweenedNumber` additions as each surface uses them),
   duplication across arcs and drift from this plan, with the same rules and the same loop-until-clean.
3. **Delivery**: only now create the PRs: `gh stack rebase` if trunk moved → the fast gates → `gh stack push`, then
   `gh stack submit --auto --open`, `gh pr edit` each body (renders, gates, codex rounds), `gh pr checks --watch`. Update `implementations-plan/index.md`.
   Never `gh stack merge`; never `bun run site:deploy`.

**The no-over-engineering rule** (verbatim in every post-impl codex prompt): *"Report bugs and small, targeted
improvements only. Do not propose speculative abstractions, extra configuration surface, new layers, or rewrites — the
smallest change that fixes each real problem. If code works and is clear, leave it alone."*

**The comment-quality rule** (verbatim in every post-impl codex prompt): *"Audit the comments for value per character.
Flag any comment that narrates what the code visibly does, restates its line, references implementation plans / phases /
reviews, or spends a paragraph where a sentence works — and flag places where a non-obvious invariant or constraint
deserves a comment it doesn't have. Comments are permanent context every future reader, human or LLM, pays to re-read:
they must be few, dense, and exact."*

Failure-retry policy: human-driven, 3 failures on one step → stop and reassess; autonomous `/loop`, 5. Lessons in
`lessons/phase-N.md` for every meaningful attempt; `agent-worktree status yacana-second-pass "phase N green: <next>"`
at each gate. Hard limits: never merge, never deploy, never push to `main`, never expand scope beyond this plan (the
contracts, the reader's storage layout, the launch mode, the OG card).

## Approval

ELI5: https://claude.ai/code/artifact/be2699e5-2b43-47b8-90e1-e4f9849d5aa5 (source `eli5.html` in this directory). Codex final verdict: `conditional approve` (all conditions adopted). Fable: `conditional approve` (all conditions adopted). **Approved by the owner on 2026-09-07** (the `/goal` was set on the plan as written; Ask 1 answered "find it": the agent locates a testnet claim's tx hash and records the example claim itself). The seeds below are final.

## Seeds

Final (approved scope, no conditions). Recommended: `/goal` (completion is transcript-observable); set by the owner on 2026-09-07.

```
/goal All phases marked ✓ in implementations-plan/yacana-second-pass/plan.md (the per-phase headers in the file — not the chat, not the task list), each ✓ backed by its phase's validation gate (as defined in plan.md) reported passing in the transcript; for each phase the agent has printed `LESSONS_FILE=implementations-plan/yacana-second-pass/lessons/phase-N.md` in the transcript; `/code-review` was NOT run (code_review is off); the codex fix loop converged for EVERY reviewed diff — each of the three arcs at its boundary plus the final cross-arc pass — each convergence evidenced by a resumed codex pass reporting no new material findings, quoted in the transcript; the Delivery section's PR topology exists on GitHub, created only AFTER all loops converged (`gh stack view` output in the transcript), each PR body linking the 1280/1440 renders beside the canvas artboard; `bun run lint` and `bun test` both report exit 0 in the transcript.
```

Alternative: `/loop 15m` (the blueprint skill's drive prompt with `bun run lint` / `bun test` as the fast layers and
this plan's path).
