// One public configuration for the three apps: site.env (the default node, RP ID) plus the
// deployment record (addresses, class ids, chain, the rollup). Production builds take nothing from the
// process environment; e2e and dev builds may override every value through VITE_* variables.
export type SiteMode = 'production' | 'e2e' | 'dev';
export const SITE_MODES: readonly SiteMode[] = ['production', 'e2e', 'dev'];

/**
 * The mode named by `YACANA_SITE_MODE`, or `fallback` when unset. Anything else throws: every value
 * but `production` relaxes the build, so a misspelling must not quietly pick the relaxed side.
 */
export function siteModeFrom(value: string | undefined, fallback: SiteMode): SiteMode {
  if (value === undefined || value === '') return fallback;
  if ((SITE_MODES as readonly string[]).includes(value)) return value as SiteMode;
  throw new Error(`YACANA_SITE_MODE=${JSON.stringify(value)}: expected one of ${SITE_MODES.join(', ')}`);
}

export interface SiteConfig {
  mode: SiteMode;
  /** The default node; a user may pick another from the miner's settings (the guard bounds requests to it). */
  nodeUrl: string;
  rpId: string;
  /** `<label>` + this suffix are this project's Workers previews, where keys may be made; '' outside production. */
  previewHostSuffix: string;
  sourceCommit: string;
  bbVersion: string;
  chainId: string;
  rollupVersion: string;
  /** The L1 rollup contract the deployment lives under: a node for another rollup is refused. */
  rollupAddress: string;
  miner: string;
  token: string;
  minerClassId: string;
  tokenClassId: string;
  /** `?node=&miner=&token=` are honoured by the page; only e2e builds set it. */
  queryOverrides: boolean;
  /** A headless Presto's plaintext port for the e2e lane; empty in production (Presto is then the SDK's HTTPS default). */
  prestoE2ePort: string;
  /** The wallet's PXE skips proving (`VITE_E2E_PROVERLESS=1`, e2e builds only): every transaction leaves unproved. */
  proverless: boolean;
  /** The landing's hero is the launch lottery (mainnet's launch week); `VITE_LAUNCH_MODE=1`. */
  launchMode: boolean;
  /** The block explorer's origin, or `off`: every address, block and transaction the pages show links there. */
  explorerUrl: string;
  /** The whole deployment record, for the Verify page; its identity fields agree with the ones above. */
  record: DeploymentRecord;
  /** One recorded claim of this deployment for the landing's ledger, or null: the tile then shows dashes. */
  exampleClaim: ExampleClaim | null;
}

/** `deployments/<profile>.example-claim.json`, written by `record-example-claim.ts` from a claim's effect. */
export interface ExampleClaim {
  miner: string;
  chainId: string;
  rollupVersion: string;
  epoch: number;
  claims: [number, number];
  block: number;
  txHash: string;
  nullifier: string;
  noteHash: string;
}

export interface DeploymentRecord {
  chainId: string;
  rollupVersion: string;
  rollupAddress: string;
  miner: string;
  token: string;
  minerClassId: string;
  tokenClassId: string;
  /** The rest of `deployments/<profile>.json` (salts, deployer, params, launch times) travels as is. */
  [extra: string]: unknown;
}

type Env = Record<string, string | undefined>;

/** Logged inside the proverless flag's own branch and nowhere else; the artifact check refuses a bundle carrying it. */
export const PROVERLESS_MARKER = 'yacana:proverless';

/** KEY=value lines; `#` comments and blank lines ignored; no quoting or interpolation. */
export const parseEnvFile = (text: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) throw new Error(`site.env: malformed line "${line}"`);
    out[line.slice(0, eq).trim()] = line.slice(eq + 1).trim();
  }
  return out;
};

const required = (source: Record<string, string | undefined>, key: string, where: string): string => {
  const v = source[key];
  if (!v) throw new Error(`${where}: ${key} is required`);
  return v;
};

/** Only the committed value, only in production: a dev or e2e build has no preview hosts. */
const previewSuffixOf = (mode: SiteMode, siteEnv: Record<string, string>): string =>
  mode === 'production' ? (siteEnv.VITE_PREVIEW_HOST_SUFFIX ?? '') : '';

export function loadSiteConfig(opts: {
  mode: SiteMode;
  siteEnv: Record<string, string>;
  deployment: DeploymentRecord;
  exampleClaim?: ExampleClaim | null;
  env?: Env;
  sourceCommit: string;
  bbVersion: string;
}): SiteConfig {
  const { mode, siteEnv, deployment } = opts;
  // Overrides exist so an e2e run can point the build at its throwaway deployment on a local node.
  const env = mode === 'production' ? {} : (opts.env ?? {});
  const pick = (key: string, fallback: string) => env[key] || fallback;
  const nodeUrl = pick('VITE_AZTEC_NODE_URL', required(siteEnv, 'VITE_AZTEC_NODE_URL', 'site.env'));
  new URL(nodeUrl);
  const rollupAddress = pick('VITE_ROLLUP_ADDRESS', deployment.rollupAddress ?? '');
  if (!rollupAddress)
    throw new Error('the deployment record lacks rollupAddress (bun run record-rollup-address)');
  const config: SiteConfig = {
    mode,
    nodeUrl,
    rpId: pick('VITE_RP_ID', required(siteEnv, 'VITE_RP_ID', 'site.env')),
    previewHostSuffix: previewSuffixOf(mode, siteEnv),
    sourceCommit: opts.sourceCommit,
    bbVersion: opts.bbVersion,
    chainId: pick('VITE_CHAIN_ID', deployment.chainId),
    rollupVersion: pick('VITE_ROLLUP_VERSION', deployment.rollupVersion),
    rollupAddress,
    miner: pick('VITE_YACANA_MINER', deployment.miner),
    token: pick('VITE_YACANA_TOKEN', deployment.token),
    minerClassId: pick('VITE_YACANA_MINER_CLASS', deployment.minerClassId),
    tokenClassId: pick('VITE_YACANA_TOKEN_CLASS', deployment.tokenClassId),
    queryOverrides: mode === 'e2e' && env.VITE_E2E_QUERY_OVERRIDES === '1',
    prestoE2ePort: mode === 'production' ? '' : (env.VITE_PRESTO_E2E_PORT ?? ''),
    proverless: mode === 'e2e' && env.VITE_E2E_PROVERLESS === '1',
    launchMode: pick('VITE_LAUNCH_MODE', siteEnv.VITE_LAUNCH_MODE ?? '') === '1',
    explorerUrl: pick('VITE_EXPLORER_URL', siteEnv.VITE_EXPLORER_URL ?? 'off'),
    record: deployment,
    exampleClaim: opts.exampleClaim ?? null,
  };
  // An e2e build carries its throwaway deployment's record, or at least its identity.
  const overridden = env.VITE_DEPLOYMENT_RECORD
    ? (JSON.parse(env.VITE_DEPLOYMENT_RECORD) as DeploymentRecord)
    : null;
  config.record = overridden ?? {
    ...deployment,
    chainId: config.chainId,
    rollupVersion: config.rollupVersion,
    rollupAddress: config.rollupAddress,
    miner: config.miner,
    token: config.token,
    minerClassId: config.minerClassId,
    tokenClassId: config.tokenClassId,
  };
  assertExampleClaim(config);
  if (mode === 'production') assertProductionConfig(config, siteEnv);
  return config;
}

const HEX32 = /^0x[0-9a-f]{64}$/;

/** The example claim is this deployment's or none: a file left over from another profile never ships. */
function assertExampleClaim(c: SiteConfig): void {
  const x = c.exampleClaim;
  if (!x) return;
  const identity = [x.miner === c.miner, x.chainId === c.chainId, x.rollupVersion === c.rollupVersion];
  if (!identity.every(Boolean))
    throw new Error(
      `the example claim is another deployment's (${x.miner} on ${x.chainId}/${x.rollupVersion})`,
    );
  const n = Number((c.record.params as { N?: unknown } | undefined)?.N ?? Number.POSITIVE_INFINITY);
  const whole = (v: unknown): v is number => Number.isSafeInteger(v);
  const [before, after] = Array.isArray(x.claims) ? x.claims : [];
  const shape =
    whole(x.epoch) &&
    x.epoch >= 0 &&
    whole(x.block) &&
    x.block > 0 &&
    whole(before) &&
    whole(after) &&
    before >= 0 &&
    after === before + 1 &&
    after <= n &&
    [x.txHash, x.nullifier, x.noteHash].every((h) => typeof h === 'string' && HEX32.test(h));
  if (!shape) throw new Error('the example claim is malformed');
}

const IP_OR_LOCAL = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|\d+\.\d+\.\d+\.\d+)$/;
/** `-<worker>.<account>.workers.dev`: the shape of a Workers preview suffix (ownership is the committed value). */
const PREVIEW_SUFFIX = /^-[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/;

/**
 * What may never reach Cloudflare: a local or plaintext node, a foreign relying party. Production
 * construction discards the build-time overrides; assembly rechecks the resolved values.
 */
export function assertProductionConfig(c: SiteConfig, siteEnv: Record<string, string>): void {
  const u = new URL(c.nodeUrl);
  if (u.protocol !== 'https:') throw new Error(`production node ${c.nodeUrl} is not https`);
  if (IP_OR_LOCAL.test(u.hostname)) throw new Error(`production node ${c.nodeUrl} is local`);
  if (c.rpId !== siteEnv.VITE_RP_ID) throw new Error(`RP ID ${c.rpId} differs from site.env`);
  if (c.explorerUrl !== 'off' && new URL(c.explorerUrl).protocol !== 'https:')
    throw new Error(`production explorer ${c.explorerUrl} is not https`);
  if (IP_OR_LOCAL.test(c.rpId) || !c.rpId.includes('.'))
    throw new Error(`RP ID ${c.rpId} is not a production hostname`);
  if (c.previewHostSuffix && !PREVIEW_SUFFIX.test(c.previewHostSuffix))
    throw new Error(`preview host suffix ${c.previewHostSuffix} is not -<worker>.<account>.workers.dev`);
}

/** Vite `define` entries: every VITE_* the apps read, as JSON literals. */
export const viteDefine = (c: SiteConfig): Record<string, string> =>
  Object.fromEntries(
    Object.entries({
      VITE_SITE_MODE: c.mode,
      VITE_AZTEC_NODE_URL: c.nodeUrl,
      VITE_RP_ID: c.rpId,
      VITE_PREVIEW_HOST_SUFFIX: c.previewHostSuffix,
      VITE_SOURCE_COMMIT: c.sourceCommit,
      VITE_BB_VERSION: c.bbVersion,
      VITE_CHAIN_ID: c.chainId,
      VITE_ROLLUP_VERSION: c.rollupVersion,
      VITE_ROLLUP_ADDRESS: c.rollupAddress,
      VITE_YACANA_MINER: c.miner,
      VITE_YACANA_TOKEN: c.token,
      VITE_YACANA_MINER_CLASS: c.minerClassId,
      VITE_YACANA_TOKEN_CLASS: c.tokenClassId,
      VITE_E2E_QUERY_OVERRIDES: c.queryOverrides ? '1' : '',
      VITE_PRESTO_E2E_PORT: c.prestoE2ePort,
      VITE_E2E_PROVERLESS: c.proverless ? '1' : '',
      VITE_LAUNCH_MODE: c.launchMode ? '1' : '',
      VITE_EXPLORER_URL: c.explorerUrl,
      VITE_DEPLOYMENT_RECORD: JSON.stringify(c.record),
      VITE_EXAMPLE_CLAIM: c.exampleClaim ? JSON.stringify(c.exampleClaim) : '',
    }).map(([k, v]) => [`import.meta.env.${k}`, JSON.stringify(v)]),
  );
