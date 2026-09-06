// The Vite configuration every app shares: the site config as `define`, the rendered headers on
// the dev/preview servers and in the build output, and the bb.js plumbing for the apps that prove.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import type { Plugin, UserConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import {
  type DeploymentRecord,
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
  /** bb.js in the bundle: Node polyfills, WASM-safe pre-bundling, module Workers. */
  prover: boolean;
  /** Served path of the app inside the origin; `/` for standalone servers. */
  base?: string;
}

const sourceCommit = (env: NodeJS.ProcessEnv): string =>
  env.CF_PAGES_COMMIT_SHA ??
  env.GITHUB_SHA ??
  execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();

/** Loads the config for the build at hand; `YACANA_SITE_MODE` picks e2e, otherwise the Vite command decides. */
export function siteConfig(command: 'build' | 'serve', env: NodeJS.ProcessEnv = process.env): SiteConfig {
  const mode = (env.YACANA_SITE_MODE as SiteMode | undefined) ?? (command === 'serve' ? 'dev' : 'production');
  const profile = env.YACANA_PROFILE ?? 'testnet';
  const deployment = JSON.parse(
    readFileSync(resolve(repo, `deployments/${profile}.json`), 'utf8'),
  ) as DeploymentRecord;
  return loadSiteConfig({
    mode,
    siteEnv: parseEnvFile(readFileSync(resolve(here, '../site.env'), 'utf8')),
    deployment,
    env,
    sourceCommit: sourceCommit(env),
    bbVersion: (
      JSON.parse(readFileSync(resolve(repo, 'node_modules/@aztec/bb.js/package.json'), 'utf8')) as {
        version: string;
      }
    ).version,
  });
}

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
      : {};
    return {
      base: app.base ?? '/',
      define: viteDefine(config),
      plugins: [
        react(),
        tailwindcss(),
        // Every app imports aztec.js (fields, addresses, the node client), which reads Buffer and
        // process at import time; only the provers need the bb.js Worker plumbing above.
        nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
        emitHeaders(renderHeaders({ nodeOrigins: config.allowedNodeOrigins, mode: 'production' })),
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
