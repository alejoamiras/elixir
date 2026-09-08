// The Vite configuration every app shares: the site config as `define`, the rendered headers on
// the dev/preview servers and in the build output, and the bb.js plumbing for the apps that prove.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin, UserConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { faviconDataUrl } from '../../ui/src/mark.ts';
import {
  type DeploymentRecord,
  type ExampleClaim,
  loadSiteConfig,
  parseEnvFile,
  type SiteConfig,
  type SiteMode,
  viteDefine,
} from './config.ts';
import { headerMap, renderHeaders } from './headers.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '../../..');
const shims = resolve(repo, 'packages/web-miner/src/shims');

export interface SiteAppOptions {
  /** The app's directory (its `src/` is the `@` alias). */
  root: string;
  /** bb.js in the bundle: WASM-safe pre-bundling and module Workers. */
  prover: boolean;
  /** Served path of the app inside the origin; `/` for standalone servers. */
  base?: string;
}

/** An e2e build may fix the commit it shows: a screenshot baseline must not move with every commit. */
const sourceCommit = (env: NodeJS.ProcessEnv): string =>
  (env.YACANA_SITE_MODE === 'e2e' && env.VITE_SOURCE_COMMIT) ||
  (env.CF_PAGES_COMMIT_SHA ??
    env.GITHUB_SHA ??
    execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim());

/** Loads the config for the build at hand; `YACANA_SITE_MODE` picks e2e, otherwise the Vite command decides. */
export function siteConfig(command: 'build' | 'serve', env: NodeJS.ProcessEnv = process.env): SiteConfig {
  const mode = (env.YACANA_SITE_MODE as SiteMode | undefined) ?? (command === 'serve' ? 'dev' : 'production');
  const profile = env.YACANA_PROFILE ?? 'testnet';
  const deployment = JSON.parse(
    readFileSync(resolve(repo, `deployments/${profile}.json`), 'utf8'),
  ) as DeploymentRecord;
  // The profile's recorded claim when there is one. An e2e build's deployment is a throwaway, so the
  // profile's claim is never its own: it ships the file `VITE_EXAMPLE_CLAIM` names, or none.
  const claimPath =
    mode === 'e2e'
      ? env.VITE_EXAMPLE_CLAIM && resolve(repo, env.VITE_EXAMPLE_CLAIM)
      : resolve(repo, `deployments/${profile}.example-claim.json`);
  const exampleClaim =
    claimPath && existsSync(claimPath) ? (JSON.parse(readFileSync(claimPath, 'utf8')) as ExampleClaim) : null;
  return loadSiteConfig({
    mode,
    siteEnv: parseEnvFile(readFileSync(resolve(here, '../site.env'), 'utf8')),
    deployment,
    exampleClaim,
    env,
    sourceCommit: sourceCommit(env),
    bbVersion: (
      JSON.parse(readFileSync(resolve(repo, 'node_modules/@aztec/bb.js/package.json'), 'utf8')) as {
        version: string;
      }
    ).version,
  });
}

/** The mark as every app's icon; the miner swaps in its status light at runtime, the others keep this one. */
const favicon = (): Plugin => ({
  name: 'yacana-favicon',
  transformIndexHtml: (html) =>
    html.replace(
      '<head>',
      `<head>\n    <link rel="icon" type="image/svg+xml" href="${faviconDataUrl('idle')}" />`,
    ),
});

/** Writes `_headers` next to the bundle so `wrangler pages dev dist` serves the shipped policy. */
const emitHeaders = (text: string): Plugin => ({
  name: 'yacana-headers',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: '_headers', source: text });
  },
});

export function siteVite(app: SiteAppOptions): (ctx: { command: 'build' | 'serve' }) => UserConfig {
  return ({ command }) => {
    const config = siteConfig(command);
    const production = headerMap({ nodeOrigins: config.allowedNodeOrigins, mode: 'production' });
    const dev = headerMap({ nodeOrigins: config.allowedNodeOrigins, mode: 'dev' });
    const proverConfig: UserConfig = app.prover
      ? {
          resolve: {
            alias: [
              // pino probes detect-node at import time; the shim keeps it on the browser build.
              { find: 'detect-node', replacement: resolve(shims, 'detect-node.ts') },
            ],
            // A second nested copy of either WASM binding leaves initAbi() and abiEncode() in
            // different module scopes, so the WASM instance never resolves.
            dedupe: ['@aztec/noir-noirc_abi', '@aztec/noir-acvm_js'],
          },
          optimizeDeps: {
            include: [
              'pino',
              'pino/browser',
              '@aztec/bb.js > comlink',
              '@aztec/bb.js > idb-keyval',
              '@aztec/bb.js > msgpackr',
              '@aztec/bb.js > pako',
              '@aztec/noir-noir_js > pako',
            ],
            // WASM loaders resolve their binaries relative to import.meta.url, which pre-bundling
            // would rewrite to a chunk that has none of them.
            exclude: ['@aztec/bb.js', '@aztec/noir-acvm_js', '@aztec/noir-noirc_abi', '@aztec/noir-noir_js'],
          },
          worker: { format: 'es' },
        }
      : {
          resolve: {
            // aztec.js reaches the proving packages through lazy imports; a page that never proves
            // resolves them to a stub, so its bundle cannot carry them and a reach fails loudly.
            alias: [/^@aztec\/bb\.js(\/|$)/, /^@aztec\/noir-(acvm_js|noirc_abi|noir_js)(\/|$)/].map(
              (find) => ({
                find,
                replacement: resolve(here, 'browser/no-prover.ts'),
              }),
            ),
          },
        };
    return {
      base: app.base ?? '/',
      // The assembly materialises the shared assets once at the origin's root; an app's own
      // `public/` copies (CRS, artifacts, slots) must not land under its base as well.
      ...(process.env.YACANA_ASSEMBLE === '1' && { publicDir: false }),
      define: viteDefine(config),
      plugins: [
        react(),
        tailwindcss(),
        // Every app imports aztec.js (fields, addresses, the node client), which reads Buffer and
        // process at import time; only the provers need the bb.js Worker plumbing above.
        nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
        emitHeaders(renderHeaders({ nodeOrigins: config.allowedNodeOrigins, mode: 'production' })),
        favicon(),
      ],
      server: { headers: dev, fs: { allow: [repo] } },
      preview: { headers: production },
      ...proverConfig,
      resolve: {
        ...proverConfig.resolve,
        alias: [
          { find: '@', replacement: resolve(app.root, 'src') },
          ...((proverConfig.resolve?.alias as []) ?? []),
        ],
      },
      // No inlined assets: the CSP allows fonts (and everything else) from the origin only, and
      // Vite would otherwise turn the small font subsets into data: URLs the policy blocks.
      build: { target: 'esnext', sourcemap: false, chunkSizeWarningLimit: 4096, assetsInlineLimit: 0 },
    };
  };
}
