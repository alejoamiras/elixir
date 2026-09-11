# preview-keys — recon (2026-09-11, base `main` @ cd2c888)

The task: let a reviewer use `/mine` (sign up, mine, claim, withdraw) on a Cloudflare preview of a branch.

## Reuse map

| capability | existing code | verdict |
|---|---|---|
| Host classification (production / preview / local / unknown) | `packages/site/src/browser/host.ts` `hostKind` — `VITE_RP_ID` → production, `*.workers.dev` / `*.pages.dev` → preview, `localhost` → local | **adapt**: add the relying party per kind, open `keysAllowed` for `preview` |
| The one enforcement point for key creation/restore | `packages/web-miner/src/session.ts` `guardHost()` (5 call sites: `createWithPasskey`, `restoreWithPasskey`, `newWords`, `wordsRecord`, `restoreWithWords`) and the `rpId` getter (`import.meta.env.VITE_RP_ID`) | **adapt**: `rpId` from the host rule; the guard message names it |
| UI gating | `packages/web-miner/src/features/KeyScreen.tsx:44` `keysAllowed(location.hostname)` disables `create-passkey`, `use-words`, `restore-passkey`, `restore-words`; `WelcomeBack` links (:214-217) are not gated (the session guard is) | reuse as is: once `keysAllowed` opens for previews the four controls open with it |
| The preview banner | `previewNotice` in `host.ts`, rendered by `web-miner/src/App.tsx:70,130`, `web-stats/src/App.tsx:86,124`, `web-landing/src/App.tsx:23,29` (`data-testid="preview-banner"`) | **adapt** the copy only; rendering untouched |
| Passkey RP plumbing | `packages/web-miner/src/keys/passkey.ts` takes `rpId` per call (`rp: { id }` at :73, `rpId` at :104); the vitest already runs with `rpId: 'localhost'` | reuse as is |
| Settings' "relying party" row | `packages/web-miner/src/routes/Settings.tsx:69` shows `VITE_RP_ID` | **adapt**: show the effective relying party |
| Production build guards | `packages/site/src/config.ts` `assertProductionConfig` (RP ID must equal `site.env`'s), `assemble.ts` inspector, `headers.ts` (no host in the policy) | **adapt** `config.ts` only: a `previewHostSuffix` field (production-only load from `site.env`, shape check); the inspector, `build.json` and the policy stay as they are |
| Preview deployment | Workers Builds "non-production branches" trigger → `wrangler versions upload`; `preview_urls: true` in `packages/site/wrangler.jsonc`; documented in `docs/deployments.md:95-103` | reuse as is; docs adapt |
| Tests of the host rule | `packages/web-miner/src/shell.vitest.tsx:61-75` (`host rules`) | **adapt** (new expectations) |
| E2E on a preview hostname | none — searched `packages/*/e2e/*.ts` for `workers.dev`, `hostname`, `preview-banner`: the miner e2e runs on `localhost` (`local` kind); `words.e2e.ts:59` checks the `host-banner` text on restore | **build new? no** — WebAuthn on a non-localhost host needs a secure context, so an e2e under a fake `workers.dev` name would need TLS in the lane; the host rule is pure and unit-tested instead (see plan) |
| Key derivation domain separation by host | `packages/miner-core/src/keys/{mnemonic,derive}.ts` derive from the phrase / PRF only; no host input | not adopted (see plan §Trade-offs) |

## Conventions to match
- Pure host rule in `packages/site/src/browser/host.ts`, consumed by the three apps; tests in `shell.vitest.tsx` under `host rules` with `vi.stubEnv`.
- Copy: one sentence, plain; `HOST_WARNING` in `KeyScreen.tsx` is the existing "whoever serves this page" line.
- Docs: `docs/deployments.md` (previews paragraph), `docs/threat-model.md` (Web page row: "keys only on `yacana.network`").

## Collision risks
- `keysAllowed` is called with `location.hostname` in `KeyScreen` and in `session.guardHost()`; both must move together.
- The `unknown` kind (`www.yacana.network`, a stranger's host) must stay locked: only the project's preview names open.
