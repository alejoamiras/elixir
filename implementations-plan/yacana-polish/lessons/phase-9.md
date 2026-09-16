# Phase 9 — The transaction dialog (arc 5, `polish-wallet`)

## Build

- `features/dialogs/Frame.tsx` (new): the one frame every money flow shares — `TxDialog` (the 440 px
  `Dialog size="tx"`, an eyebrow, the title, a body line; `locked` while something proves or a wallet is
  asked: no close, no dismiss), `Row`/`Rows` (the summary rows with a second line under the value), `Foot`
  (the line under a stepper), `Actions` (the primary beside its quiet alternative, one mono line under),
  `Primary`, `Quiet`, `Back`, `AmountBelow` (the refusal left, the balance right), `useElapsed`, `hhmm`.
- `features/dialogs/Wallet.tsx` (new): the Ethereum wallet inside a dialog — `ConnectWallet` (one installed
  wallet is one **Connect wallet** button, several are listed by name and icon, none says where to get one),
  `WalletChip` (name · address · network, × disconnects), `YacaAvailable`, `useWalletChain` (the switch as a
  step of its own, with `WrongNetwork`'s note), `useWalletName`, `useYacaBalance`, `noEth`.
- `features/dialogs/Send.tsx`: one screen. `amountRefusal` on input, `recipientRefusal` when the field is
  left (both in `withdraw-form.ts`, in the brief's words), the probe (`session.recipientKnown`) after a
  refusal-free address, advisory; How as two radios; the public note; the button carries the amount and the
  mode and waits on a refusal; a first click with nothing typed shows "Enter an amount."; the proof as a
  locked stepper; the receipt with the block and the transaction linked. The send checks the exact values it
  submits again (`review`) and uses nothing the probe saw.
- `features/dialogs/ToEthereum.tsx`: the connected wallet as the recipient with quiet **Change**, else the
  pasted address in full with "pasted · not your connected wallet" and the check-every-character line;
  `ethRefusal` (`bridge/forms.ts`) under the field on the click; the three rows; **Bridge 3.5 tYACA**; How it
  works as a screen with Back; proving locked; sent with the stations and the proof deadline.
- `features/dialogs/FromEthereum.tsx`: the connect screen, then the chip with what it holds, the standing
  notes (closed for good / the announced upgrade), the amount against the wallet's YACA, the rows, the
  switch step, the payer's ETH read before the wallet is asked, **Confirm in Rabby** as a locked step, then
  the stations with Etherscan.
- `features/dialogs/Claim.tsx`: one dialog for the claim on Ethereum (K1), the forward and the redeem
  (K2) — the rows name the payer and the fixed recipient, the switch is a step, the ETH is read first, the
  wallet's rejection is a red step with **Try again**, a portal refusal is the row's sentence (`revertLine`),
  done links Etherscan.
- `features/dialogs/SendAhead.tsx`: the whole balance by default, the four rows, **Send 3.5 tYACA ahead**,
  How it works (the five stations and the never-opens note on `deadlinePhrase`), the locked proof, the five
  stations after, **Save a recovery file** under Done with its line. `Mine.tsx` opens it; `OldApp.tsx` keeps
  `SendAheadSheet` (now on `AmountField`) until P10.
- `routes/Wallet.tsx`: `MoneyDialogs` and `SendDialog`; `RailTile.tsx`: the claim slot gone (the claim lives
  on the loop's chip and the ledger since P4). Deleted: `ToEthereumSheet`, `DepositSheet`, `SendSheet`,
  `ClaimSlot`, `AmountInput`.
- Specs: `forms.vitest.tsx` (new: the refusals under their fields, the button waiting, the probe's note, the
  public note, the receipt; the address parser stubbed since bb.js cannot run in jsdom), `withdraw.bun.test`
  (the refusal strings, the Ethereum ones too), `bridge-features.vitest` ('the dialogs' under wagmi),
  `cockpit.vitest` (the rail without the slot); `withdraw.e2e.ts` (one screen), `bridge-states.e2e.ts` (the
  switch as a step the wallet confirms once, the refused deposit, the prompt left open as a step), the rig's
  `bridge.e2e.ts` (no review screens); `connectTestWallet` accepts the one-button connect screen.
- `CLAUDE.md`, `docs/threat-model.md`, `docs/upgrades.md`: sheet → dialog.

## Decisions and departures

- The wrong-network step is on every dialog that asks the wallet (deposit, claim, forward, redeem), not the
  claim alone: §9.2.5 names the claim, but the same wallet pays the same way in the other three, and one
  `useWalletChain` serves all four.
- The proving screens replace the form rather than freezing it (§5.4 says "freezes the form"): the dialog
  is locked either way, and the stepper is where the proof's elapsed time and the keep-this-tab-open line
  live (§5.5's proving board).
- The unknown-recipient probe never blocks the send: the brief calls it inline and advisory; the click
  re-validates the exact values and sends.
- The recovery file's re-offer (§9.3.6) is the activity tile's standing **save a recovery file** plus the
  Sent screen's prompt; no timed nag.
- `SendAheadSheet` stays for the old origin until P10 as the plan says; it moves to `AmountField` so
  `AmountInput` can go now.

## The reopen that stuck (canary run 1)

`withdraw.e2e.ts` timed out on its second send: Done, then **Send** again 200 ms later, and the page sat
under a dimmed overlay with no dialog for 20 minutes. The trace (references resolved from the frame
snapshots) shows the closing dialog still mounted when the click landed — Radix keeps an exiting dialog
until its animation ends (the content's 200 ms outlasts the overlay's 150 ms) — and the final DOM holding
the overlay at `data-state=closed` with the content gone: a Presence left waiting for an animation end
that never comes. Reviving the closing dialog was also why the form flashed through the fade-out (the
snapshot right after Done shows the fields inside the closing content: `close()` reset the step at once).

Fix: `useOpening(open)` in `Frame.tsx` — a counter that ticks on every opening — and each dialog mounts
its run on that key (`SendDialog` → `SendRun` and so on). A reopen is a new Radix root with `open` from
its first render, nothing to race; the closed run keeps its last screen through the fade-out and every
field resets by construction, so the on-close resets are gone. `forms.vitest` covers the clean reopen;
the canary covers the real thing.

Canary run 2 got past the reopen and stuck on the **Publicly** radio: an `sr-only` input is a 1 px box
under its label, so a real click — Playwright's `getByRole('radio')` like a finger — lands on the label
and never on the input. The input now covers its segment invisibly (`absolute inset-0 opacity-0`), the
label carries the focus ring through `has-[:focus-visible]`; jsdom never noticed either way.

## Gate (2026-09-16)

| layer | result |
|---|---|
| lint, web-miner typecheck | clean |
| `bun test packages/web-miner packages/bridge` | 247 pass, 3 skip |
| `test:components` (web-miner 107, 22 files) | green |
| `bridge` shard, proverless (the injected wallet) | 1/1 passed, 3.5 min; again after the per-opening change, 3.6 min |
| `canary` shard, real proving (withdraw among it) | 4/4 passed on the third run, 5.1 min (withdraw 103 s, 3 proofs); runs 1–2 above |
| replay (`test:replay`) | 4/4 passed, 42 s |
| `bun run rig -- browser` (the rig's `bridge.e2e.ts`) | 3/3 passed: V5 2.9 min · flip 12 s · V6 1.2 min |

Pass criteria: cancellation boundaries and disabled reasons match the send's ownership — an Aztec send
(Send, Bridge to Ethereum, Send ahead) locks the dialog while the browser proves and offers nothing but
Done after; an Ethereum send (deposit, claim, forward, redeem) locks while the wallet is asked, and before
that its button is off for exactly the reasons the page owns (the wrong network with the switch offered, no
ETH for the gas, an amount the form refuses) while the wallet's own refusal comes back as a step or a line.

## Arc-5 codex fix loop (§10 steps 2–3)

### Round 1 — `/codex high` (GPT-6 Astra, `high`, read-only), verdict **REVISE**, 15 findings

Prompt: `scratchpad/codex-arc5-round1.md` over `git diff polish-facts...HEAD` (P8 `f28231e` + P9 `cdf3d94`),
both verbatim rules. Its own verification: the row tests 7 passed, the bun run 236 passed with six
sandbox-only failures, Vitest sandbox-blocked. Every reproduction it described was re-derived here before
anything was applied; all fifteen held.

Applied, in its numbering:

1. **#1 high** — no submission guard: two clicks on Send ran the validation twice and sent twice; a click
   whose validation outlived Cancel still sent. `useOnce()` in `Frame.tsx` takes a synchronous in-flight
   ref before the first await (a state flag alone lets two clicks in one tick through), and `useLive(open)`
   is read after every await that ends in money moving: a run whose dialog closed meanwhile does nothing.
   Send, the deposit and the claim's `go` run under it. The claim additionally drops a funds read that
   answers after unmount (`alive`). Cancel stays clickable while the address is checked — the dialog is not
   locked then, and Escape already closed it — which is what makes the second test possible.
2. **#2 high** — every crossing was read under this build's deadline and pause. `BridgeSession` now reads
   each other version that has a crossing in the journal (`otherVersions`, pinned to the same block as the
   own read, the previous value kept on a failed read) into `view.versions[v]: {standing, deadline}`;
   `rows.ts` picks the facts by `c.version` (`factsOf`) and, with none, assumes nothing: the open-ended
   phrase, no pause.
3. **#3 medium** — Claim never locked: `Body` reports its step up (`onStep`), the run locks the dialog
   while the wallet is asked and keeps the body when the wallet disconnects mid-request; the chip's × is
   hidden while locked (`WalletChip locked`).
4. **#4 medium** — no ETH was read once: `usePayerFunds` re-reads every 5 s while the refusal stands, and
   `go` reads again on the click before the wallet is asked.
5. **#5 medium** — the forward title said `nextVersionName()` after the flip: the dialog uses
   `targetOf(crossing, view, flipped)`, the row's own reading (exported from `rows.ts`).
6. **#6 medium** — the redeemed row named the redeem key: `Crossing.recipient` is the address the YACA was
   minted to, recorded by the flow at the redeem and by the reconciliation from the `Redeemed` log
   (`portal-reader.redeemed()` returns it; `Facts.redeemed.recipient`); the row says "at 0x…" only when it
   is known. `ethAddress` stays the key that signs.
7. **#7 medium** — How it works unmounted the draft: the form stays mounted under the explanatory screen
   (`contents` / `hidden`) in Send ahead, To Ethereum and From Ethereum.
8. **#8 medium** — Claim was offered for an arrival on another version: `elsewhereOf` names where it is
   claimed (`claim on V6` / `claim on another version`), no action.
9. **#9 medium** — the badge counted by chip colour: `waitsOnUser(line)` — an action that is present, not
   disabled, not Settings, and not the quiet forward beside a redeem — so an urgent red claim counts; the
   claims in flight live in `claimingAtom` (id → started at) shared by the Shell's badge and the list, a
   second tap on a row already claiming does nothing.
10. **#10 medium** — the dead `details` action is gone (`RowAction` no longer has it); Details shows the
    claim's tx ("claim ↗") and the deadline sentence ("can leave …").
11. **#11 medium** — `rpcFailing` after a good read now reads as "can't read the upgrade" for the rows
    that turn on it (`verdictUnknown`), tested read-then-silence.
12. **#12 medium** — the deposit form runs `moneyStanding` itself: a pause, a lost registration or a
    silent RPC hold the form with the Wallet button's reason (`deposit-off`), not only closed deposits.
13. **#13 low** — copy fidelity: the no-wallet Bridge to Ethereum offers **Connect wallet** (a `connect`
    step, back to the form once connected); the pasted tag compares against the connected address; the
    no-flip deadline carries its "after that, until the upgrade after V6 lands" clause; a K3 `sent` reads
    as a deposit ("sent from Rabby"); the list names the wallet through `walletNameAtom` (the connector's
    name, "your wallet" before one connects); a row in flight shows "proving · 60 s" and a bar against the
    usual 20 s (`RowLine.progress`); the claim's done title is the verb ("Claimed.") and the deposit's
    waiting title is "Bridging 1 YACA."; the frozen-headroom row no longer offers Details as its action.
14. **#14 low** — tests: the row tests assert attention by expected state, not by colour; a Send spec for
    the double click and the Cancel that outlives validation (the dialog under a host that owns `open`);
    a Claim spec under wagmi's mock connector for the top-up re-read, the lock while the wallet is asked,
    the done title, and the wallet's refusal; a From Ethereum spec for the paused form; the
    "read-then-silence" row test.
15. **#15 low** — the dialog headers narrated their screens; each keeps its invariants only. The false
    Details comment went with the action.

Departures, recorded rather than applied:

- **The claim's done step links the Etherscan tx, not the L1 block number** the board prints: the flow
  keeps no receipt block, and adding one to the journal for a number the link already leads to is not
  worth a field.
- **"claim on another version"**: the page names only this build and the canonical (`versionNameOf`); an
  arrival on a third version is "another version", which is what the holder can act on from here.
- **The Bridge to Ethereum connect step** says "The wallet the YACA goes to." — the canvas has no body line
  for that state; one sentence, in the dialog's voice.
- **The deposit's waiting title** is "Bridging 1 YACA." for both the wallet prompt and the crossing, the
  board's wording for the crossing; the step below says which.

Two things the round taught about the test bench, for the next one:

- **wagmi's `WagmiProvider` reconnects on mount**, and the mock connector refuses to reconnect unless
  `features.reconnect` is on — a test that connects in `beforeAll` and then awaits anything sees the
  wallet disconnected a tick later. A synchronous assertion right after `render` hides it.
- **`wagmi/connectors` pulls `@wagmi/connectors`, which imports `viem/tempo`** — absent from viem 2.38.
  The root `wagmi` export carries `mock` (and `createConfig`, `http`); `wagmi/actions` is clean.
