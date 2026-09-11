---
plan: preview-keys
tier: light
driver: claude-code
eli5_mode: artifact
code_review: off
status: approved to implement (codex round 1 → conditional approve, round 2 → conditional approve; every condition folded in; the owner delegated the open questions to this loop)
created: 2026-09-11
base: main @ cd2c888
---

# preview-keys — usable `/mine` on this project's Cloudflare previews

## Goal

A reviewer opens a branch's Workers preview (`<branch>-yacana.alejo-amiras.workers.dev/mine/`), signs up with a
passkey or twelve words, mines, claims and withdraws on the testnet deployment. Accounts made there are for
testing: a passkey is bound by the authenticator to that exact preview host; twelve words are portable (the same
phrase is the same account everywhere), so the page tells reviewers to use a fresh account and never to reuse words
between a preview and `yacana.network`. No new build mode: a preview is the production bundle, deciding at runtime
from the hostname.

Today `packages/site/src/browser/host.ts` classifies every host ending in `.workers.dev` / `.pages.dev` as
`preview`, `keysAllowed` returns false, `KeyScreen` disables the four entry controls and `session.guardHost()`
refuses; nothing downstream (mining, claiming) is gated, it is only unreachable without an account. Passkeys would
fail anyway: `session.rpId` is the build's `VITE_RP_ID` (`yacana.network`), which WebAuthn refuses on a
`workers.dev` origin.

**Owner's answers (Phase 0, from the request):** done = `/mine` usable end to end on a preview; production
behaviour unchanged; the open questions are to be settled with codex, not the owner; quality bar production;
`code_review: off` (the codex loop is the review); validation layers: lint + typecheck + bun test + Vitest, the
miner e2e on `localhost` as the regression net, no networked e2e added; `/harden` not scheduled.

## Architecture & Implementation (compact)

**The preview host is named, not a category.** Round 1 (codex) showed the current rule — any `*.workers.dev` —
would open key creation on an unchanged copy of the bundle on a stranger's Cloudflare tenant. The rule becomes:
a host is a `preview` iff it is `<label><suffix>` where `suffix = VITE_PREVIEW_HOST_SUFFIX`
(`-yacana.alejo-amiras.workers.dev`, from `site.env`, the same public record that holds the RP ID) and `<label>` is
one non-empty DNS label (`/^[a-z0-9-]+$/`, no dots). Cloudflare's version hosts (`252abc2b-yacana.…`) and branch
aliases (`e2e-lanes-proverless-yacana.…`, verified live 2026-09-11) both match; `foo.evil.workers.dev`,
`x-yacana.other.workers.dev`, `deep.x-yacana.alejo-amiras.workers.dev` and every `pages.dev` host do not (the Pages
project is gone, `docs/deployments.md`). This is an honest-bundle rule: code that controls the page can delete it;
it exists so an unmodified mirror does not invite keys. **Accepted limitation (round 2):** the suffix names the
account's namespace, not this Worker: `other-yacana.alejo-amiras.workers.dev` (a different Worker named
`other-yacana` in the same account) would also match. We trust control of the account's namespace, as we already
trust it for the production RP ID; no deployment registry.

```ts
// packages/site/src/config.ts — SiteConfig gains
/** `<label>` + this suffix are this project's Workers previews; empty disables previews (e2e/dev builds). */
previewHostSuffix: string;
// loader: mode === 'production' ? (siteEnv.VITE_PREVIEW_HOST_SUFFIX ?? '') : ''  — never pick()/required():
// production takes the committed value whatever the process env says; dev/e2e always ''.
// production check: '' or /^-[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/ (shape, not ownership; ownership is the
// committed site.env, as for the RP ID). viteDefine emits VITE_PREVIEW_HOST_SUFFIX. build.json unchanged.

// packages/site/src/browser/host.ts
export type HostKind = 'production' | 'preview' | 'local' | 'unknown';
export const hostKind = (hostname: string): HostKind;   // production → preview(suffix rule) → local → unknown
/** The WebAuthn relying party this host may use: the pinned production RP ID, or the preview host itself. */
export const relyingParty = (hostname: string): string =>
  hostKind(hostname) === 'preview' ? hostname : import.meta.env.VITE_RP_ID;
export const keysAllowed = (hostname: string): boolean =>
  kind === 'production' || kind === 'preview' || (kind === 'local' && VITE_SITE_MODE !== 'production');
export const previewNotice = (hostname: string): string | null;  // preview and unknown copy below; else null
```

- `preview`: keys allowed, RP = the exact host (never shortened to the account subdomain). A passkey created on
  the alias is a different credential from one created on a version URL; the vault (IndexedDB) is per origin too.
  Words: no RP; the same phrase restores the same account on any host (derivation unchanged, see trade-offs).
- `production`, `local`: unchanged. `unknown` (`www.yacana.network`, any other host): locked, as today.

**Consumers.**
- `packages/web-miner/src/session.ts`: `get rpId()` → `relyingParty(location.hostname)` (reaches all three
  ceremonies: `createPasskey` :257, known-record `assertPasskey` :299, discoverable `assertPasskey` :307); the
  five `guardHost()` sites unchanged; the guard message replaced. The constructor's deps object gains optional
  `passkeys: { createPasskey, assertPasskey }` so a bun test can prove which RP ID reaches WebAuthn.
- `packages/web-miner/src/features/KeyScreen.tsx`: no logic change (`keysAllowed` opens the four controls).
- `packages/web-miner/src/routes/Settings.tsx:69`: "relying party" shows `relyingParty(location.hostname)`.
- The three `App.tsx` banners: rendering unchanged, copy from `previewNotice`.

**Copy** (codex's wording, adopted).
- preview: `Preview on <host>. Use a new account for testing; never reuse twelve words between this preview and
  yacana.network.`
- unknown: `This is not yacana.network. Accounts cannot be created or restored here.`
- guard (session error): `Accounts cannot be created or restored on this host. Open yacana.network.`

**Flow.** Load `/mine/` on the preview → `hostKind` = preview → banner → `KeyScreen` controls enabled →
`createWithPasskey` → `createPasskey({ rpId: <preview host> })` → record in this origin's IndexedDB → wallet opens
→ mining/claiming exactly as production (same bundle, same node, same guards).

**Files.** `packages/site/site.env` (+`VITE_PREVIEW_HOST_SUFFIX`), `config.ts` (+field, production check,
define), `config.test.ts`, `browser/vite-env.d.ts`, `browser/host.ts`, `web-miner/src/session.ts`,
`web-miner/src/routes/Settings.tsx`, `web-miner/src/shell.vitest.tsx` (host matrix), a new
`web-miner/tests/session-rp.bun.test.ts`, `docs/deployments.md`, `docs/threat-model.md` (Web page + Keys rows).

**Alternatives not taken.**
- *A build-time preview mode* set by the non-production trigger: it neither authenticates the code nor changes
  what the RP must be (the host), and it forks the artifact (`assemble`, the inspector, `build.json`, the mode
  union). Runtime selection fits identical artifacts.
- *Words-only on previews*: reviewers could not exercise the default sign-up (passkey + PRF), the path most worth
  reviewing on a real domain.
- *Host-separated words derivation*: it would stop honest preview code from opening a production account by
  accident, but not PR code from reading the phrase or applying production derivation, which is the attack that
  matters. For this bounded change the derivation stays one function; cross-host phrase reuse is an accepted,
  documented risk and the banner warns in both directions.
- *A category rule (`*.workers.dev`)*: rejected in round 1, see above.

## Phases

### P1 — the named preview host, the relying party, the copy, the tests (one phase)

1. `site.env` + `config.ts` + `vite-env.d.ts`: `VITE_PREVIEW_HOST_SUFFIX`; production check (empty or the
   suffix shape); `config.test.ts` covers accepted / refused shapes, production taking the committed value over a
   conflicting process env, dev/e2e resolving to `''` even with a suffix configured, `viteDefine` emitting it.
2. `host.ts`: suffix rule, `relyingParty`, `keysAllowed` opens `preview`, the two notices.
3. `session.ts`: `rpId` from `relyingParty`; injectable passkey ceremonies; the guard message.
4. `Settings.tsx`: effective relying party.
5. Tests. `shell.vitest.tsx` host matrix under `VITE_SITE_MODE=production`: apex → production; alias and version
   hosts → preview + RP = host + keys allowed; foreign tenant (`x-yacana.other.workers.dev`), another Worker in
   the account (`x-other.alejo-amiras.workers.dev`), a `pages.dev` host, a deceptive suffix
   (`x-yacana.alejo-amiras.workers.dev.evil.example`), a nested label, `www.yacana.network`, `evil.example` →
   unknown, locked, RP = production; empty suffix → nothing is a preview; `localhost` → local, locked in
   production, allowed otherwise. `session-rp.bun.test.ts`: with `globalThis.location.hostname` set to a preview
   host and faked ceremonies (narrow types `typeof createPasskey` / `typeof assertPasskey`, capturing options and
   throwing a sentinel), `createWithPasskey`, the known-record `open()` (an unsealed passkey record, so it reaches
   assertion) and `restoreWithPasskey` each receive `rpId === hostname`; on an `unknown` host `createWithPasskey`
   and `restoreWithPasskey` end in `bootAtom` `signedOut` with the guard's error and zero ceremony calls (the
   session reports failures through state, its promises resolve). `open()` of a known record is not guarded
   today and stays that way. Globals restored after each test.
6. Docs. `docs/deployments.md` previews paragraph: what a reviewer can do; use the branch alias (the version URL
   is a different origin: a different vault and a different passkey); if the alias ever changes, its passkeys are
   unusable on the new hostname, words still restore. `docs/threat-model.md`: the Web page row (keys on `yacana.network` and on the
   named previews, RP = host) and the Keys row (RP-scoped passkeys, origin-scoped vault, portable words).

**Validation gate**
- `bun run lint` — exit 0.
- `bun run --cwd packages/web-miner test:components` — green (host matrix, shell specs).
- `bun test packages/site packages/web-miner` — exit 0 (config shapes, session RP wiring).
- `E2E_SHARD=cockpit bun run e2e:agent -- bun run --cwd packages/web-miner test:e2e` — the passkey and miner
  specs on `localhost` still green (the session change under the real ceremony with a virtual authenticator).
- Layers: lint/typecheck · unit (Vitest + bun) · e2e (local kind).

## Security & Adversarial Considerations

- **Threat model.** Attacker = whoever gets a branch built by Workers Builds (the repository's collaborators;
  whether fork pull requests are ever built is *not verified* — treat every preview as code you have not
  reviewed). Target = a reviewer's production account. Passkeys: the browser refuses `rpId: yacana.network` on a
  preview origin, so PR code cannot assert a production passkey; a preview passkey is bound to its host. Words:
  PR code can read whatever is typed; nothing in the page can prevent that; the banner tells reviewers never to
  reuse words across hosts, and the docs call preview accounts disposable. A compromised later push to the same
  alias inherits that origin's vault (words records and convenience-mode passkeys especially): disposable is the
  operational claim.
- **Production unchanged.** `assertProductionConfig` still pins the built RP ID to `site.env`; `relyingParty`
  returns it on the apex. The `unknown` kind stays locked; `www.yacana.network` remains an apex redirect. A
  malicious page on a `yacana.network` subdomain could request `rpId: yacana.network` — an existing production
  boundary (`passkey.ts:94` comment), not changed here; no such host is created.
- **Why not `preview.yacana.network`.** It would make the production RP ID valid on PR code. Rejected.
- **CSP.** Unchanged (`connect-src https:` already admits any POST; the fetch guard is code the branch controls).
  No relaxation needed, none made.
- **Least privilege / supply chain.** No workflow, token or dependency changes. `VITE_PREVIEW_HOST_SUFFIX` is
  public information (every preview URL shows it).

## Assumptions

**Facts**
1. `hostKind`/`keysAllowed`/`previewNotice` in `packages/site/src/browser/host.ts:4-24` are the only host rule;
   consumers: `web-miner/src/session.ts:108-115` (getter + guard), `features/KeyScreen.tsx:44`, `App.tsx:70`,
   `web-stats/src/App.tsx:86`, `web-landing/src/App.tsx:23`.
2. `session.ts` passes `this.rpId` to `createPasskey` (:257) and to `assertPasskey` twice (:299 known record,
   :307 discoverable); `passkey.ts` uses it as `rp.id` (:73) and `rpId` (:104). No other RP source.
3. Previews are production builds: Workers Builds runs `bun run build` in `packages/site` on every non-`main`
   branch (`docs/deployments.md:95-103`); `assertProductionConfig` (`config.ts:169-180`) pins
   `rpId === site.env.VITE_RP_ID`.
4. `workers.dev` and `pages.dev` are on the Public Suffix List (verified 2026-09-11 against the live list), so
   `<label>.workers.dev` is a registrable domain and the exact preview hostname is a valid RP ID for its origin.
5. The real hosts: `https://252abc2b-yacana.alejo-amiras.workers.dev` (version) and
   `https://e2e-lanes-proverless-yacana.alejo-amiras.workers.dev` (alias), from the Cloudflare check run on
   commit `e7009f3`; the alias serves `/mine/` with the production CSP (curl, 2026-09-11).
6. The vitest `host rules` (`shell.vitest.tsx:61-75`) stubs `VITE_RP_ID`/`VITE_SITE_MODE` and asserts
   `keysAllowed(preview) === false` today; `tests/session-open.bun.test.ts` fakes preflight/start through the
   constructor's deps object and supplies fake ceremonies by calling `runAttempt` directly (:43).
7. Words derive from the phrase alone (`miner-core/src/keys/mnemonic.ts:26`, `derive.ts`); the same phrase is the
   same account on every host.

**Inferences**
- I1. Branch aliases are stable across pushes (Cloudflare's 2025-07-23 changelog on preview URLs; the alias
  above survived four pushes on 2026-09-10). If an alias ever changes, passkeys made on it are unusable on the
  new host; words still restore. Documented.
- I2. PRF-capable authenticators treat a `workers.dev` RP like any registrable domain. Local virtual-authenticator
  tests do not prove real platform behaviour; the PR says "not yet checked live" until a person signs up on
  this branch's preview with a physical authenticator (an agent cannot obtain that result).
- I3. Namespace trust: the suffix excludes other tenants, not other Workers in this account (see Architecture).

**Asks** — settled with codex (round 1, `audit-codex.md`), none returned to the owner:
- A1 passkeys on previews with RP = exact host: agreed. A2 derivation unchanged, risk documented both ways:
  agreed. A3 runtime rule only: agreed. A4 no TLS e2e; unit coverage strengthened (host matrix + session RP
  wiring): agreed.

## Post-implementation

Single arc. `code_review: off` — `/code-review` is not run.

1. **Codex audit** (`/codex high`, fresh session): the net diff from `main`, this plan, the adversarial/security
   ask, and verbatim:
   *"Report bugs and small, targeted improvements only. Do not propose speculative abstractions, extra
   configuration surface, new layers, or rewrites — the smallest change that fixes each real problem. If code
   works and is clear, leave it alone."*
   *"Audit the comments for value per character. Flag any comment that narrates what the code visibly does,
   restates its line, references implementation plans / phases / reviews, or spends a paragraph where a sentence
   works — and flag places where a non-obvious invariant or constraint deserves a comment it doesn't have.
   Comments are permanent context every future reader, human or LLM, pays to re-read: they must be few, dense,
   and exact."*
2. **Fix loop**: verify each claim against the repo, apply accepted fixes, commit, log the round in
   `lessons/phase-1.md`, resume the same session with the fix diff; repeat until a round yields no material
   findings; hard stop at 3 rounds → surface.
3. **Delivery** (the first time a PR exists): `gh pr create` from `worktree-preview-keys`, then
   `gh pr checks --watch`; fix reds; the merge is the owner's call. The PR body records the live check (I2)
   once the branch's own preview is up.

## Delivery

One arc = P1, one branch `worktree-preview-keys`, one PR onto `main`. `code_review: off`.

## Seeds

Draft; finalized after approval.

```
/goal P1 marked ✓ in implementations-plan/preview-keys/plan.md with its validation gate (lint, the web-miner Vitest host matrix, bun test for site + web-miner, the cockpit e2e shard) reported passing in the transcript; `LESSONS_FILE=implementations-plan/preview-keys/lessons/phase-1.md` printed; the codex fix loop converged (a resumed codex pass reporting no new material findings, quoted); the PR exists (`gh pr view` output) created only after convergence; `bun run lint` and `bun test` exit 0 in the transcript.
```
