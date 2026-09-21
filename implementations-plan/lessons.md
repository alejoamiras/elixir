# Lessons

Generalizable gotchas promoted from closed plans, one line each, linking to the archived detail. Budget: about 8 KiB; prune on every promotion.
- Chrome's Local Network Access **is** testable in headless Playwright: launch with `--ip-address-space-overrides=<page origin>=public` (a loopback-served page is otherwise same-address-space and ungated), deny with `grantPermissions([], { origin })`, grant with `['local-network-access']`. This corrects [presto-mine phase 2](presto-mine/lessons/phase-2.md) ("headless does not block", "denied cannot be produced"); the technique is Presto's own `lna.real.spec.ts`. Before calling a browser behaviour untestable, read how the dependency's own repo tests it. ([yacana-feedback-pass](yacana-feedback-pass/plan.md), Fact 19)
