# Phase 2 — the stepper, and the scrollbar that would not reproduce

## I1 is refuted: the owner's horizontal scrollbar was not reproduced (2026-09-21)

The plan inferred that the scrollbar in "the pop-up" came from the opening checklist's nowrap right column, and
committed to seeing the overflow assertion red on the old stepper first. It never went red. Three attempts, all
in Chromium 151 (the build Playwright 1.62.1 pins):

| Attempt | What ran | Result |
|---|---|---|
| 1 | `opening.e2e.ts` with the new assertion at 900 × 720, real proving, **old** stepper | passed: no overflow in the dialog or the page |
| 2 | A scratch harness: the old and the new stepper, server-rendered into the account dialog's exact box with the built CSS, fed every string the page writes into the right column (`first time only`, a byte count, `1 min 20 s`, `no answer for 1 min 20 s`, `held by another tab`), with and without a 17 px classic scrollbar | every case fits, old and new |
| 3 | A scratch replay spec over every signed-out account screen (welcome, create, log in, the 12 words, the quiz, restore) × six window sizes (900 × 720 down to 1280 × 480, 700 × 560, 420 × 700), classic scrollbars forced | every case fits |

Why the inference was wrong: the old grid was `18px 1fr auto`, and `1fr` is `minmax(auto, 1fr)`, whose floor is
the label's longest **word**, not the label. The label column gives way long before the dialog does: a nowrap
cell has to pass roughly 290 px (about fifty mono characters) before anything overflows, and the longest reason
the page can write is twenty-four.

What is true, and measured: the mechanism exists. A 120-character nowrap cell widened the 440 px dialog by
**401 px** on the old stepper (416 px with a classic scrollbar) and by 0 on the new one, where the cell wraps. So
the right column no longer carries `whitespace-nowrap`, and `opening.e2e.ts` measures the dialog with such a
reason swapped into the running step's cell. That is a guard on a mechanism, **not** a fix for what the owner
saw, and the commit says so.

Two things the attempts did not cover, for whoever picks this up: the owner's own browser and OS (the feedback
came from a real Chrome, not headless), and which pop-up it was. The remark sits directly under the stepper
bullet about "Confirm / claiming / end", which reads like a **transaction** dialog; but those have no
`overflow` rule at all and cannot draw a scrollbar. Only the account dialog (`overflow-y-auto`, which computes
`overflow-x` to `auto`) and the Document Picture-in-Picture window can. Logged in `follow-ups.md`: ask for a
screenshot.

Headless notes that cost time: Playwright launches Chromium with `--hide-scrollbars`, so a vertical scrollbar
takes 0 px and a layout that only breaks when 15–17 px go missing cannot break. `ignoreDefaultArgs:
['--hide-scrollbars']` plus `--disable-features=OverlayScrollbar` gives the 17 px classic bar. `page.addStyleTag`
is silently dropped by the page's CSP.

## The stepper

- The rail is a flex child of the ring's column (`flex-1`, `min-h-3`), so it is exactly as tall as its step. The
  old `::after` was a fixed 22 px at `top: 27px`: short under a paragraph, into the next ring under a one-liner.
- `showsDetail` is exported and tested as a function; the component spec checks the rule on the DOM and the
  rails (`data-slot="step-rail"`, `data-done`).
- The plan said **five** "How it works" screens; there are **three** that draw a `Stepper`
  (`ToEthereum`, `FromEthereum`, `SendAhead`). `Send` and `Claim` have no explainer list.
- `Stepper`'s row had to become its own component: the inline `map` body scored 16 on Biome's cognitive
  complexity (max 15) once the rail and the rule went in.
- `Opening.tsx` keeps its own mechanism (it strips `detail`, and its `SUB` line sits under the bar); it got the
  geometry only, as planned.

## Gate (2026-09-21, at 5fea9f3)

Fast: lint 0 · typecheck 0 · web-miner typecheck 0 · `bun test` 507 pass, 0 fail · components ui 72 (the new
`stepper.vitest.tsx`: the rule as a function, on the DOM, and the rails), landing 14, miner 121
(`sign-in.vitest.tsx` unchanged), stats 84 · replay 4 passed.
`E2E_PROVERLESS=0 E2E_SHARD=canary … test:e2e`: exit 0, 4 passed in 6.0 min under real proving: the canary
(the tampered claim refused at proving, the restored one minted), `opening.e2e.ts` with the overflow and the
long-reason measurements, withdraw, words.
