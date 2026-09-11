# preview-keys — codex audit (plan)

Session `01a09036-981e-7173-b72d-15e6bcbfacdf`, GPT-6 Astra at `high`, 2026-09-11.

## Round 1 — verdict: conditional approve

Adopted: the named preview host (suffix from site.env, `pages.dev` dropped); isolation claims removed and words documented as portable; the host matrix and session RP-wiring tests; the three copy strings; the provenance argument deleted; the fork-PR claim downgraded to unverified. Rejected: nothing.

**Conditional approval.** I support A1–A4, but the plan currently promises isolation it does not implement. Confidence: **high** on the code findings; **moderate** on browser compatibility without a live preview check.

**Facts**

1. **The preview rule does not identify this project.** `packages/site/src/browser/host.ts:8` accepts every hostname ending in `.workers.dev` or `.pages.dev`. Opening that category enables an unchanged copy of the bundle on an attacker’s Cloudflare tenant. The plan’s “project’s previews” and “stranger’s mirror stays locked” claims are false.

   Restrict eligibility to the verified account subdomain and the `*-yacana` preview label, with exact DNS-label boundaries. Obtain the account subdomain from deployment evidence; do not guess it. Remove `pages.dev` eligibility: the documented Pages project is gone (`docs/deployments.md:123`). This is an honest-bundle restriction; an attacker controlling the JavaScript can still remove it.

2. **Words are portable; accounts do not “belong to this preview only.”** `packages/miner-core/src/keys/mnemonic.ts:26` derives from the phrase alone; `derive.ts:38` adds no host input. `packages/web-miner/src/session.ts:367` restores that master and derives its address. Production words entered on a preview therefore recover the same account, and preview words can subsequently be used on production.

   Remove “keys that can never reach a production account” from `plan.md:17` and the equivalent banner assurance at `plan.md:63`.

3. **RP plumbing is reusable, but there are three session call sites**, covering creation, known-record opening, and discovery/restore: `session.ts:257`, `:299`, `:307`. The five guards are at `:253`, `:306`, `:330`, `:345`, `:366`. The proposed getter reaches all three ceremonies.

4. **Fact 4’s RP conclusion is sound with qualifications.** `workers.dev` is listed in the [Public Suffix List](https://publicsuffix.org/list/public_suffix_list.dat). An HTTPS preview’s exact effective domain is a valid RP ID under [WebAuthn](https://www.w3.org/TR/webauthn-3/). That establishes domain eligibility, not universal PRF support. Nor is RP scope strictly “this hostname and nothing else”: descendant origins can request a parent RP, as the existing comment correctly explains at `passkey.ts:94`.

5. **The stated session-guard test coverage is overstated.** `shell.vitest.tsx:61` tests host helpers. `tests/session-open.bun.test.ts:43` exercises `runAttempt` directly with fake ceremonies. Neither demonstrates that a preview session sends its hostname to WebAuthn.

**Inferences**

- **I1 — stable aliases: supported, high confidence.** Cloudflare documents [stable per-branch preview URLs](https://developers.cloudflare.com/changelog/post/2025-07-23-workers-preview-urls/). However, losing an alias is more than a documentation inconvenience: a saved passkey cannot authenticate on the replacement hostname. Document that limitation alongside per-origin storage.
- **I2 — PRF compatibility: reasonable, moderate confidence.** Exact-host RP selection introduces no apparent protocol obstacle. Local virtual-authenticator tests do not establish real browser/platform support.
- **Hostname does not prove build provenance.** `plan.md:78` is incorrect. Cloudflare also creates version URLs for production deployments; the hostname identifies where code is served, not which trigger built it. See [Cloudflare’s preview URL documentation](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/).

**Asks**

| Decision | Position and strongest counterargument |
|---|---|
| **A1: exact-host passkeys** | **Yes — high confidence.** Words-only avoids disposable-host recovery problems, but forces reviewers toward transferable secrets and leaves the default signup path untested. Keep exact-host RP IDs; never shorten to the account subdomain. Document that alias and version URLs have separate passkeys. |
| **A2: unchanged derivation** | **Yes, with corrected claims — moderate confidence.** Your argument dismisses a real benefit: separation prevents accidental account reuse in honest code. It does not stop malicious preview code from stealing the phrase or applying production derivation. For this bounded change, preserve derivation and explicitly accept cross-host phrase reuse as a risk. Warn in both directions. |
| **A3: runtime rule** | **Yes — high confidence.** Build mode could distinguish intended deployment behavior, but it would not authenticate code or protect against a malicious branch. Runtime selection fits identical artifacts. Narrow the hostname rule and remove the provenance argument. |
| **A4: no fake-domain TLS E2E** | **Yes, with stronger unit coverage — moderate confidence.** A browser test would verify secure-context/RP behavior, which pure tests cannot. Its infrastructure cost is disproportionate here. Add focused session wiring tests; retain local E2E. Describe live preview compatibility as unverified until someone exercises it. |

**None of A1–A4 needs to return to the owner.** The absolute isolation promise is the draft’s mistake, not an achievable guarantee that these choices deliver.

**Production and adversarial review**

- **Apex production behavior:** the proposed helper preserves its RP ID and eligibility. `assertProductionConfig` checks equality with `site.env` at `packages/site/src/config.ts:193`; it does **not** validate runtime preview selection or independently pin a literal domain. Keep that check unchanged.
- **Unknown hosts:** retain denial. The guard steers honest code; it cannot protect phrases typed into a malicious page.
- **`www.yacana.network`:** the unchanged bundle remains locked, and deployment documentation specifies an apex redirect (`docs/deployments.md:115`). But malicious code served there could request `rpId: yacana.network`. This is an existing production trust boundary, not a new preview regression.
- **CSP:** `packages/site/src/headers.ts:19` permits HTTPS connections, while `:23` permits same-origin scripts. Malicious branch code is allowed script. The fetch guard is JavaScript controlled by that same branch (`browser/node-guard.ts:1`), so neither it nor the banner is an adversarial boundary. No CSP relaxation is necessary.
- **Stable preview compromise:** later code on an alias inherits access to that origin’s stored vault. Words and convenience-mode passkeys are especially exposed (`keys/store.ts:1`). “Disposable review accounts” is the appropriate operational claim.
- **Supply chain:** this change requires no dependencies, tokens, or broader permissions. The “fork PRs are not built” assertion at `plan.md:113` needs deployment evidence; the cited documentation establishes branch triggers, not the complete authorization policy.

**Architecture and validation**

Keep the existing host module, getter, controls, banners, and Settings consumer. No policy framework or derivation layer is needed.

Add a compact production-mode host matrix: apex, approved alias/version hosts, foreign Workers tenant, unrelated Worker in the same account, Pages host, deceptive suffix, `www`, unknown, and localhost. Preserve the existing non-production localhost behavior.

Add focused session tests proving the effective RP reaches creation and both assertion paths, plus rejected-host behavior before credential/derivation work. The current helper tests could pass while the session getter remains unchanged.

Update **both** threat-model rows (`docs/threat-model.md:42`, `:44`), distinguishing RP-scoped passkeys, origin-scoped storage, and portable words.

**Copy**

Replace the preview banner with:

> Preview on `<host>`. Use a new account for testing; never reuse twelve words between this preview and yacana.network.

Unknown-host banner:

> This is not yacana.network. Accounts cannot be created or restored here.

Guard message:

> Accounts cannot be created or restored on this host. Open yacana.network.

This avoids the existing inaccurate “only” claim once previews are supported (`session.ts:114`).

conditional approve (with conditions: restrict eligibility to verified project Workers previews and remove Pages eligibility; remove absolute account-isolation claims and document portable words in both threat-model rows; add production-mode host-boundary and session RP-wiring tests).

## Round 2 — verdict: conditional approve

Adopted: the same-account Worker-name ambiguity documented as an accepted namespace-trust assumption; the unknown-host tests narrowed to the guarded creation/restoration paths, asserting the signed-out state and zero ceremony calls (open() of a known record is unguarded today and stays so); the production-only suffix loader specified and tested (committed value over process env; dev/e2e always empty; viteDefine emits it); site.env kept over a constant; narrow ceremony injection; the alias-change wording. Rejected: nothing.

**The revised design is sound, with two remaining corrections: the suffix identifies an account namespace, not uniquely a Worker, and the guard test overstates what `open()` enforces.** Confidence: **high**.

**Facts**

**(a) The rule covers the documented version/alias forms.** Cloudflare uses `<version-or-alias>-<worker>.<account>.workers.dev`; aliases contain lowercase letters, digits and hyphens. Version prefixes can start with digits, so do not require a leading letter. Your two evidenced hosts match. [Cloudflare naming rules](https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/)

With the committed suffix, another Cloudflare account cannot match. However, these also match:

```text
other-yacana.alejo-amiras.workers.dev
x-other-yacana.alejo-amiras.workers.dev
```

Those names could represent the ordinary URL and a preview of a different Worker named `other-yacana` in the **same account**. This follows from Cloudflare’s [ordinary Worker URL format](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/) and preview format. I evaluated the proposed matcher against both examples.

Therefore, amend `plan.md:36–44`: the rule excludes foreign tenants but cannot prove Worker identity. **Accept this limitation and trust control of the account’s matching namespace.** Do not add a deployment registry to solve it.

Your regexes are character/shape checks, not complete DNS validation: they permit leading hyphens and overlong labels. That does not create cross-account acceptance with this fixed suffix. Calling the prefix a “non-empty lowercase alphanumeric/hyphen string without dots” is accurate. Full DNS validation is unnecessary for this bounded rule.

**(b) Adding `SiteConfig.previewHostSuffix` has no inherent production regression.**

- `assemble.ts:50` explicitly selects four fields for `build.json`; the new field will not appear automatically.
- `artifact.ts:80` accepts a `Pick<SiteConfig, ...>` of existing mode/override fields.
- `artifact.ts:40` checks the record’s mode, not an exact schema.
- `assemble.ts:82` loads validated config before building apps.
- `vite-base.ts:58` loads the shared `site.env`.

Leave `BuildRecord`, the inspector and CSP unchanged. `build.json.rpId` remains the **configured production RP**, while Settings displays the effective runtime RP.

**The unknown-host test needs narrowing.** `plan.md:120` says the guard fires before any ceremony. But `session.ts:282` opens known records without `guardHost()`, and `:299` can invoke assertion. This is existing behavior.

Test creation/restoration refusal on unknown hosts; do not silently add an `open()` guard. Also, asynchronous session failures become `bootAtom.error` through `session.ts:222–227` and `:118–124`; their public promises generally resolve. Assert that state and zero ceremony calls, rather than expecting promise rejection.

**Inferences**

- **Namespace trust:** the revised suffix meaningfully excludes unrelated tenants. It does not establish reviewed code, exclusive Worker identity, or branch provenance. Document the same-account ambiguity above.
- **Production preservation:** high confidence from the proposed control flow, subject to implementing the loader correctly and passing validation.
- **Real authenticator compatibility:** still moderate confidence. Keeping the live check outside the automated gate is reasonable. Record “not yet checked” until it actually happens; an agent cannot promise a physical-authenticator result it cannot obtain.
- **Alias recovery:** `plan.md:122` should say “unusable **on the new hostname**.” Changing an alias does not itself invalidate credentials at the old hostname if that origin remains available.

**Asks / implementation choices**

**Keep `site.env`; I prefer it over a constant.** The strongest case for a constant is fewer fields, declarations and tests for one deployment-specific value. But the repository already centralizes public deployment configuration, so this is modest plumbing with a clear home.

Specify the loader exactly:

```ts
previewHostSuffix:
  mode === 'production' ? (siteEnv.VITE_PREVIEW_HOST_SUFFIX ?? '') : '',
```

Do not use `required()`, which rejects the supported empty value (`config.ts:91`), or the generic `pick()` path (`:109`), which would undermine “previews off in dev/e2e.”

Alongside shape tests, verify these actual invariants:

- Production takes the committed suffix despite a conflicting process environment.
- Dev/e2e resolve and emit `""`, even when configuration contains a suffix.
- `viteDefine` emits the resolved value.

The production regex validates **shape**, not ownership. The committed `site.env` value supplies ownership policy, just as it supplies the production RP ID.

**(c) Injecting the two ceremonies is the smallest clean test seam here.** It follows the constructor’s existing dependency pattern (`session.ts:85–93`) and avoids module-wide mocks or replacing browser globals beyond hostname/environment setup.

Keep it narrowly typed with `typeof createPasskey` and `typeof assertPasskey`; no service interface is needed. For these wiring tests, fakes can capture options and throw a sentinel immediately. That proves the selected RP without constructing a working wallet or duplicating derivation tests. Use an **unsealed** known-passkey record so `open()` actually reaches assertion (`session.ts:285`).

Restore modified globals/environment after each test and avoid concurrent execution of tests sharing those overrides.

**Security and copy**

The revised portable-words warning, unchanged CSP, exact-host RP and disposable-account explanation address the material production risks. No new dependency or credential surface is needed.

All three copy strings are acceptable as written. The unknown/guard messages correctly concern creation and restoration, not opening existing records.

Two small documentation corrections remain:

- Fact 6: constructor dependencies fake preflight/start; the existing test supplies fake ceremonies through direct `runAttempt` access (`session-open.bun.test.ts:43`).
- `recon.md:15` still says the config guard changes nowhere; update its verdict to reflect the added suffix check.

No asks need to return to the owner.

conditional approve (with conditions: document the same-account Worker-name ambiguity as an accepted namespace trust assumption; narrow unknown-host tests to guarded creation/restoration paths and assert their actual error behavior; specify and test production-only suffix loading).

# Post-implementation fix loop

Session `01a09045-39ee-78c3-a842-f8099375f886`, high.

## Round 1 — changes required (one P2)

Adopted: the env restore (assigning undefined to process.env stores "undefined"); the comment cuts in host.ts and the two tests; "treat preview code as unreviewed". Rejected: nothing.

One required fix; no production regression found. Confidence: **high**.

The implementation matches the agreed security rules:

- [host.ts:9](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/site/src/browser/host.ts:9) requires the exact suffix and a nonempty `[a-z0-9-]+` prefix without dots. Foreign tenants, nested labels, Pages and `www` remain locked. Apex eligibility and RP selection are preserved.
- [config.ts:99](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/site/src/config.ts:99) loads the committed suffix only in production; the existing production guards remain intact. The inspector, build-record selection and CSP are unchanged.
- All three session calls use injected ceremonies and `this.rpId`: [creation:268](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/web-miner/src/session.ts:268), [known-record assertion:310](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/web-miner/src/session.ts:310), [restore:321](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/web-miner/src/session.ts:321). Creation’s internal fallback forwards the same options at [passkey.ts:89](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/web-miner/src/keys/passkey.ts:89). Exact-host RP selection follows the [WebAuthn RP rules](https://www.w3.org/TR/webauthn-3/#relying-party-identifier).

The tests cover the promised host matrix, production-only loading, three preview ceremonies, and unknown-host refusal through `bootAtom` with zero ceremony calls. Known-record `open()` remains unguarded as explicitly agreed. No material coverage hole beyond the cleanup defect below.

The banner strings and guard match the approved wording. [deployments.md:105](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/docs/deployments.md:105) and [threat-model.md:42](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/docs/threat-model.md:42) correctly distinguish RP-scoped passkeys, origin-scoped storage and portable words. Minor copy precision: replace “a branch is code nobody has reviewed yet” with “treat preview code as unreviewed.”

Nonblocking comment cleanup:

- [host.ts:1](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/site/src/browser/host.ts:1): replace the four-line introduction with the non-obvious constraint: “This gate steers honest bundles; the suffix trusts the account’s matching namespace, not code provenance.”
- [host.ts:22](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/site/src/browser/host.ts:22): “may use” overstates authorization—unknown hosts also receive the configured RP. Clarify that callers enforce eligibility. Delete the line-38 comment, which repeats the predicate.
- [shell.vitest.tsx:80](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/web-miner/src/shell.vitest.tsx:80) and [session-rp.bun.test.ts:8](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/web-miner/tests/session-rp.bun.test.ts:8) repeat the cases/test structure. At line 60, use the actual constraint: “Keep this record unsealed so `open()` reaches WebAuthn.”

Independent validation: focused Bun suites **10 passed, 77 assertions**. Vitest startup was blocked by the read-only filesystem; E2E and physical-authenticator validation remain outstanding.

changes required:

1. **[P2] Restore absent environment variables by deleting them.** [session-rp.bun.test.ts:25](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/web-miner/tests/session-rp.bun.test.ts:25) assigns saved `undefined` values into `process.env`. Verified on Bun 1.4.0: this produces the literal string `"undefined"` and leaves the property present, contaminating subsequent tests. For each saved variable, delete it when the original value was `undefined`; otherwise restore its string value.

## Round 2 — approve (no new material findings)

No new material findings. Confidence: **high**.

The [environment cleanup](/home/homelab/Projects/elixir/.claude/worktrees/preview-keys/packages/web-miner/tests/session-rp.bun.test.ts:24) correctly deletes absent variables and restores existing values. Comment and documentation changes resolve the review points without changing production behavior.

Independent validation: **20 tests passed, 110 assertions** across session RP, session opening and site configuration. Cockpit E2E remains pending.

approve