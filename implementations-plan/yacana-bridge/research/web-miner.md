# research — the web miner, the site layer, miner-core and stats/landing (for the guided path)

Persisted from a read-only research agent (2026-09-12). Paths repo-relative; line numbers of main at that date. The
agent had no shell; "every"/"the only" claims come from following imports, re-verify with a listing when extending.

## 1. `packages/web-miner/src/session.ts`, `wallet.ts`

- `Session` (569 lines): `createWithPasskey`, `open(record)`, `restoreWithPasskey`, `newWords`/`createWithWords`,
  `restoreWithWords`, `markBackedUp`, `forget`, `nodeUrl`, `probeNode`, `switchNode` (443-489), `startMining`,
  `recipientKnown` (529-532), `withdraw` (539-552), `publicBalance`, `setStayOpen`. One PXE namespace at a time;
  `runAttempt`/`attemptBody` (150-243) is a generation-counted attempt/abort machine. **`Session.pre` (line 62) is
  set once in the constructor and never replaced: nothing can point a live session at a different deployment.**
- `withdraw` IS "mining pauses while a transfer proves": `c.pause('withdraw')` → `c.track(() => sendWithdraw(...))`
  → `c.release('withdraw')`. Pause reasons today: `withdraw, switch, battery, hidden, offline, lost-race`
  (`controller.ts:347-360`). A send-ahead adds a reason.
- Fees: `wallet.ts` `openWallet` (59-87) registers `SponsoredFPCContract` (`SPONSORED_FPC_SALT`) and builds `Fee =
  {paymentMethod: SponsoredFeePaymentMethod, gasSettings: claimGasLimits(node)}` (`miner-core/src/claim.ts:14-19`).
  A fee-payer abstraction lives here.
- `resetAccountView` (`wallet.ts:124-140`): stop → `indexedDB.deleteDatabase(pxeDb)` (10 s grace,
  `ChainViewHeldError`) → fresh `openWallet` + `registerAccount`; used on first open when the view fingerprint is
  stale (`boot.ts:315`) and by the controller's `recover` closure (`boot.ts:330-343`).
- IndexedDB: `pxeNamespace()` (`wallet.ts:39-42`) = `yacana-pxe-<chainId>-<rollupVersion>-<rollupAddress>`, one PXE
  store per rollup tuple shared by every key on the device; NOT keyed by miner/token. Account secrets are memory-only
  (`wallet/memory-store.ts`), re-derived every open.
- `switchNode` only repoints the node URL (`boot.ts` `switchNodeLive` 211-230: pause, drain, `setNodeEndpoint`,
  `switchable.use`, `resetNodeHealth`, `controller.rebuildForNewNode`); it never recomputes `pre.expected` or
  `connection.miner/token`.

## 2. `keys/store.ts`, `keys/passkey.ts`

- `MasterRecord` (11-25): `{v:1, id, method, createdAt, credentialId?, sealed?, askEveryOpen, backedUp, account:
  {address, index: 0}}`; IndexedDB `yacana-keys` v1 (store `records`, store `device` with one non-extractable
  AES-GCM key); `seal/unseal` AES-GCM-256 with AAD `yacana-key:<v>:<method>:<id>`; `addressOf(master, index)`
  (138-141) = `deriveAccountFields` + `getSchnorrInitializerlessAccountContractAddress`; `openMaster` (154-171)
  re-derives and **fails closed** if the address differs ("opens a different account than the one on this device").
- The address does not depend on chainId, rollup version, miner or token. It depends on the SDK-pinned
  `SchnorrInitializerlessAccount` class: a Yacana redeploy keeps it; **an Aztec upgrade that changes the account
  class (a new aztec.js) changes it**, and `openMaster` would then throw for every existing record. So the V6
  build's key store must key the stored address by account class id (or re-derive and migrate the record).
- `passkey.ts`: WebAuthn PRF, `PRF_LABEL='yacana.passkey.prf.v1'`, resident + user-verified; `NoPrfError`. The RP ID
  is a registrable-domain boundary: a passkey made on `yacana.network` is retrievable from `v5.yacana.network`
  (`restoreWithPasskey`, a discoverable request) once `hostKind` admits that host.

## 3. `boot.ts`, `state.ts`, `controller.ts`, `chain.ts`, `public-epoch.ts`, `prover-loop.ts`

- `boot.ts`: `preflight()` (88-176: isolation, node, deployment rows; reuses `probeNode`); `expectedOf()` (54-63)
  builds the one `ExpectedDeployment`; `startSession()` (263-379) opens in five steps (`key/node/crs/notes/ready`,
  weights in `opening-steps.ts:12`), checks `viewBuiltOn`/`endpointFingerprint` (65-80, 313-314), `registerAccount`,
  `attachDeployment`, `readEpochRules`, then builds the controller with a `recover` closure.
- `state.ts` atoms (26-37): `bootAtom` (`preflight|signedOut|opening|ready|error`), `minerAtom`, `epochAtom`,
  `rulesAtom`, `balanceAtom` (`bigint|null`, memory only), `claimsAtom`, `logAtom`, `crsAtom`, `signInAtom`,
  `nowAtom`.
- `controller.ts`: one `d: Deployment`, one `domain` = `deployDomain(chainId, rollupVersion, minerAddress,
  PARAMS.VERSION)` (269-272); `refresh/readChain` (367-422) serialised and generation-guarded; `poll` every 10 s,
  `'offline'` pause after 60 s of failures; `submit` (561-610) is the claim path (`sendClaim` → inclusion →
  `claimMarks` → `claimsAtom`).
- Claim narration: `features/ClaimSlot.tsx` `slotState()` (idle / `NoticeCard` / `ClaimStepper` / 10 s-fresh
  `Acknowledged`); `ClaimStatus.tsx` (`ClaimStepper` proving→sent→waiting with a TTL countdown; `NoticeCard` per
  `NoticeKind` from `miner-core/src/claim-failure.ts`); `LedgerTile.tsx` (`LedgerLine[]` capped at 200).
- `chain.ts`: `attachDeployment` (36-57), `sendClaim/sendRoll/readBalance/readPublicBalance/sendWithdraw`
  (150-163, nonce 0), `recipientKnown` (169-173).
- `public-epoch.ts`: the signed-out reader through `miner-core/src/reader.ts`, polled every 30 s, stopped once the
  controller's first read lands.

## 4. Settings, routes, shell, primitives

- `settings.ts`: one localStorage key `yacana.settings`, `parseSettings` degrades unknown fields individually,
  `settingsAtom` persists on write. `routes.ts`: `Route = 'mine'|'wallet'|'settings'`, `navigate(route, intent?)`
  (only `'send'` exists), `takeIntent()`. NOTE: `src/routes.ts` (router) vs `src/routes/*.tsx` (route bodies).
- `App.tsx` `Shell` (65-140): header (`Mark`, `NAV`, `StatusPill`), then `previewNotice` `Alert` + `NodeBanner`
  (130-136) above `{children}` — the slot for the migration card and the arrival card. `App()` (142-189):
  boot-error `Alert` + `NodeWayOut`, `PreflightTile`, `PrestoBanner` + `Mine`, `Wallet`, `Settings`, `SignInDialog`,
  the host caveat, `Toaster`.
- `components/NodeTile.tsx`: `useNodeHealth` (10 s probe), `CheckForm` + `lib/node-check.ts` reducer
  (idle→checking→ok/failed→switching→switched); the template for an `EthRpcTile`.
- Where things slot in: a new route = the `Route` union + a `NAV` entry + `src/routes/<X>.tsx`; the journal tile
  mirrors `routes/Wallet.tsx` `ClaimsHistory` (117-151); a new sheet extends `features/SendSheet.tsx`'s `Step` union
  (45-49) with `Sheet/SheetContent/SheetTitle/SheetDescription` and the ui `Stepper` as `SignInDialog`'s `Opening`
  (68-105) and `ClaimStepper` do.
- ui primitives (`packages/ui/src/components`): `Sheet*` (right slide, `max-w-md`), `DialogContent({hideClose?,
  overlayClassName?})`, `Stepper({steps: Step[]})` with `Step = {id, label, state: pending|active|done|failed, ms?,
  detail?, right?}`, `Preflight({rows, action?})`, `StatusPill({status})` with `Status = idle|opening|mining|
  claiming|minted|not-backed-up|paused`, `NodeBanner`, `NodeWayOut`, `Alert*`, `Tile/TileHeader/KvRow`,
  `TileBoundary`, `Progress`, `Chip/ChipLink`, `HoldButton`, `Toaster`.

## 5. The site layer

- `connection.ts`: `KEY='yacana.connection'`; `Connection{nodeUrl, miner, token}`; `fromStorage()` persists ONLY
  `nodeUrl`; `fromQuery()` only in e2e on localhost. In production nothing persisted can point the app at another
  miner/token pair.
- `node-guard.ts` `installNodeGuard()` (236-271), one per realm (page + prover Worker): admits `data:`/`blob:`, the
  one node endpoint (`setNodeEndpoint`, with deadline + health reporting + cooldown), the accelerator set
  (`setAcceleratorEndpoints`, deadline only, never reported), a leased candidate (`allowCandidate(url,
  deadlineMs)`), same-origin; everything else throws `blocked endpoint …`. An Ethereum RPC needs either a
  permanent second slot (a `setEthRpcEndpoint` with its own health) or the candidate lease for a sheet's lifetime.
  The CSP (`headers.ts:19-26`, `connect-src 'self' data: https:`) already allows it; `artifact.ts` (52-59) pins
  every `_headers` to the production map, so a CSP change would touch all three apps — do not.
- `node-health.ts`: the transport machine for the one node endpoint only.
- `host.ts`: `hostKind()` (production = `VITE_RP_ID` exact; preview = `VITE_PREVIEW_HOST_SUFFIX` regex; local;
  unknown), `keysAllowed()`; `session.guardHost()` (121-126) gates key creation.
- `config.ts` `loadSiteConfig()` (103-160) computes every `VITE_*` from `site.env` + `deployments/<profile>.json`
  (`YACANA_PROFILE`, default testnet); `assertExampleClaim()` rejects decorative data from another deployment;
  `assertProductionConfig()` (194-209) forbids local/plaintext nodes, a foreign RP ID, a non-https explorer.
- `site.env`: `VITE_AZTEC_NODE_URL`, `VITE_RP_ID`, `VITE_PREVIEW_HOST_SUFFIX`, `VITE_LAUNCH_MODE`,
  `VITE_EXPLORER_URL`. No per-deployment fields.
- `assemble.ts`: `APPS` landing `/`, miner `/mine/`, stats `/stats/` (23-27); `REDIRECTS` exact deep links (34-40);
  writes `_headers`, `_redirects`, `build.json` `{mode, commit, nodeOrigin, rpId}`; production runs
  `assertProductionArtifact()`.

## 6. `packages/miner-core/src`

- Domain separators: `yacana.params.json` `$domains` (`DEPLOY/SECRET/WORK/TICKET/NULL/SEED/LAUNCH`, tags
  `YACA/…`) → `generated/params.ts` `DOMAINS` and the Noir globals via `scripts/params-codegen.ts`. A bridge tag
  (`YACA/exit`, `YACA/redeem`) registers there so TS and Noir agree.
- `proof.ts`: `deployDomain(chainId, rollupVersion, minerContract, version)` (43-49) — the protocol's own notion of
  "a deployment"; `secretCommitment`, `ticketNullifier`. `secret.ts` `newEpochSecret()` (CSPRNG → `Fr`) is the
  pattern for an exit secret. `claim.ts` `buildClaim`, `claimGasLimits`.
- `reader.ts` `assertDeployment()` (52-81): chainId, rollupVersion, rollupAddress, both instances + class ids, the
  bound token — four call sites (`boot.ts`, `site/browser/node.ts`, `web-stats/src/chain.ts`,
  `web-landing/src/live.ts`), all single-deployment. `readTotalSupply`, `readLatestBlock`, `assertTimestamp`,
  `pooled`.
- Noir↔TS parity pattern: `retarget.test.ts` ("same vectors as the `#[test]`s in `retarget.nr`"),
  `keys/derive.test.ts` (golden hex vectors) — plain `*.test.ts` (both runners).
- No secp256k1 anywhere: an Ethereum-signature check would be new surface (the redeem key is an L1-side signature,
  verified by the portal in Solidity — not by Noir).

## 7. Tests

- Playwright: `testMatch: /.*\.e2e\.ts$/`, `globalSetup` → Bun `e2e/run-setup.ts`: needs `AZTEC_NODE_URL`; claims
  ports; deploys an "easy" (target `1n<<127n`) and an "impossible" Yacana; two RPC proxies (`proxyA/proxyB`) for
  `switch.e2e.ts`; writes `e2e/.run.json` (`E2eRun`, no L1 field yet).
- `e2e/helpers.ts`: `virtualAuthenticator(page)` (CTAP2.1 + PRF via CDP) — headless account creation;
  `passKeyScreen`, `bootPage` (8 min), `pageUrl` (query overrides only in e2e builds).
- `e2e/fixtures.ts`: the `proofMeter` auto-fixture fails a passing test that did not prove as often as expected.
- Shards `e2e/shards.json` (`cockpit`, `chain`, `canary`); `run-suite.ts` + `proof-inventory.ts` check the titles;
  the replay lane (`e2e/replay/*`) is signed-out only.
- `tests/*.bun.test.ts` for WASM/crypto; `vitest.config.ts` includes `src/**/*.vitest.tsx` + `src/**/*.test.ts`,
  excludes `*.bun.test.ts`.

## 8. web-stats

- `routes.ts`: `Route = 'stats'|'verify'` + `?epoch=`/`?from=` helpers; a `bridge` route is one union member, one
  `routeFromPath` branch, one `NAV` entry. `App.tsx` `Shell` (76-154) with `Freshness()`; `<main data-settled>`
  drives the screenshot gate. `beats.ts` (two beats), `read-fixed.ts`, `history-fill.ts`, `history-cache.ts` — the
  one correctly namespaced key: `yacana.epochs.v1.<chainId>.<rollupAddress>.<miner>.<endpoint>` (21-27), the
  reference for any bridge cache key.
- `features/Observatory.tsx`: six `TileBoundary` KPI tiles; `routes/Verify.tsx` `DeploymentTile` (42-92) is the
  deployment record tile; `explorer.ts` is Aztec-only (`VITE_EXPLORER_URL`) — an Etherscan helper and a
  `VITE_L1_EXPLORER_URL` are new.

## 9. web-landing

- `copy.ts` `SECTIONS = ['hero','money','chain','how','verify','ask']` is the page's whole structure; `footer.links`.
  **There is no router** (`src/routes.ts` does not exist): the page is anchor sections with a sticky `Bar`. A FAQ
  is either (a) one more section (`sections/Faq.tsx`, cheapest, consistent) or (b) a fourth app in `assemble.ts`
  `APPS` at `/faq/` (own package, Vite config, tests). The announcement line: an `Alert` in the landing's
  `App.tsx` slot (29-40) beside `previewNotice`/`NodeBanner`, or a `copy.hero` field beside `reassurance`.
- `live.ts` is a near-duplicate of the stats reader; `sections/Verify.tsx` a third copy of the deployment chip row.

## Every single-deployment assumption

1. `connection.ts` `Connection{nodeUrl, miner, token}`, persists `nodeUrl` only. 2. `expectedDeployment()` /
`expectedOf()` build one `ExpectedDeployment`. 3. `assertDeployment` hard-throws, four call sites. 4.
`Session.pre` set once; `switchNode` never changes the deployment. 5. `MinerController` one `d`, one `domain`. 6.
`config.ts` one record per build, `assertExampleClaim` enforces it. 7. `PARAMS`/`DOMAINS` one profile per build.
8. `pxeNamespace` keyed by rollup, not by miner/token. 9. `viewBuiltOn` fingerprint = `pxeDb` + node endpoint —
**a same-rollup redeploy of miner+token (the testnet rehearsal!) is not detected and does not reset the view.**
10. The guard's one `endpoint`. 11. `yacana.claims` (`main.tsx:20-44`) unscoped by account or deployment. 12.
`history-cache.ts` is the correct counter-example. 13. `live.ts` / `web-stats/src/chain.ts` one miner/token each.
14. Keys are deployment-independent (the pleasant exception).

## Storage keys

localStorage: `yacana.connection` (`{nodeUrl}`), `yacana.settings`, `yacana.pxe-view.<pxeDb>` (endpoint
fingerprint), `yacana.claims` (unscoped), `yacana.presto` (banner element), `yacana.epochs.v1.<…>` (stats cache).
IndexedDB: `yacana-keys` (records + device key; device-wide), `yacana-pxe-<chainId>-<rollupVersion>-<rollupAddress>`
(the PXE), bb.js CRS cache (`idb-keyval`, purged each boot). Memory only: account secrets.
