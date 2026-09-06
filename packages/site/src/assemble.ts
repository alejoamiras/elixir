// Three apps into one origin (`/`, `/mine/`, `/stats/`), the shared assets once at the root,
// `_headers`, `_redirects`, `build.json`. `bun run site:build` → packages/site/dist; an e2e run
// passes its own out dir.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Route as MinerRoute } from '../../web-miner/src/routes.ts';
import type { Route as StatsRoute } from '../../web-stats/src/routes.ts';
import { copyArtifacts } from '../scripts/copy-artifacts.ts';
import { copySlots } from '../scripts/copy-slots.ts';
import { fetchCrs } from '../scripts/fetch-crs.ts';
import type { SiteConfig } from './config.ts';
import { renderHeaders } from './headers.ts';
import { siteConfig } from './vite-base.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '../../..');
export const PRODUCTION_OUT = resolve(here, '../dist');

/** Where each app lands; the landing goes first because emptying `/` would delete the nested apps. */
export const APPS = [
  { name: 'web-landing', base: '/' },
  { name: 'web-miner', base: '/mine/' },
  { name: 'web-stats', base: '/stats/' },
] as const;

/**
 * The nested apps' deep links as exact 200 rewrites to each app's directory: Pages evaluates
 * `_redirects` before static assets (a wildcard would shadow the app's bundle) and turns an
 * `.html` target into a canonical 308.
 */
const MINER_LINKS: Record<Exclude<MinerRoute, 'mine'>, true> = { wallet: true, settings: true };
const STATS_LINKS: Record<Exclude<StatsRoute, 'stats'>, true> = { verify: true };
export const REDIRECTS = [
  ...Object.keys(MINER_LINKS).map((r) => `/mine/${r} /mine/ 200`),
  ...Object.keys(STATS_LINKS).map((r) => `/stats/${r} /stats/ 200`),
  '/verify /stats/ 200',
];

export interface BuildRecord {
  mode: SiteConfig['mode'];
  commit: string;
  nodeOrigins: string[];
  rpId: string;
}

export const buildRecord = (c: SiteConfig): BuildRecord => ({
  mode: c.mode,
  commit: c.sourceCommit,
  nodeOrigins: c.allowedNodeOrigins,
  rpId: c.rpId,
});

/** An app's bundle without its `public/` copies: the shared assets are materialised once at the root. */
function buildApp(name: string, base: string, outDir: string, env: NodeJS.ProcessEnv): void {
  execFileSync('bunx', ['vite', 'build', '--base', base, '--outDir', outDir, '--emptyOutDir'], {
    cwd: resolve(repo, 'packages', name),
    stdio: 'inherit',
    env: { ...env, YACANA_ASSEMBLE: '1' },
  });
}

export async function assemble(out: string, env: NodeJS.ProcessEnv = process.env): Promise<BuildRecord> {
  // The config is loaded once here so a production build fails before any app is built.
  const config = siteConfig('build', env);
  // What Cloudflare serves is `dist` of a Cloudflare build: neither may hold anything but production.
  if (config.mode !== 'production' && (out === PRODUCTION_OUT || env.CF_PAGES))
    throw new Error(`a ${config.mode} build may not land in ${out}: production builds only`);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  for (const app of APPS) buildApp(app.name, app.base, resolve(out, app.base.slice(1)), env);
  await fetchCrs(out);
  await copyArtifacts(out);
  console.log(await copySlots(out));
  cpSync(resolve(repo, 'packages/web-landing/public/og.png'), resolve(out, 'og.png'));
  writeFileSync(
    resolve(out, '_headers'),
    renderHeaders({ nodeOrigins: config.allowedNodeOrigins, mode: 'production' }),
  );
  writeFileSync(resolve(out, '_redirects'), `${REDIRECTS.join('\n')}\n`);
  const record = buildRecord(config);
  writeFileSync(resolve(out, 'build.json'), `${JSON.stringify(record, null, 2)}\n`);
  return record;
}

if (import.meta.main) {
  const out = resolve(process.argv[2] ?? PRODUCTION_OUT);
  const record = await assemble(out);
  console.log(`site: ${record.mode} build of ${record.commit.slice(0, 7)} in ${out}`);
}
