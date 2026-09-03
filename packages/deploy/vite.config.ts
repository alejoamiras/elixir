import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// The aztec packages spawn workers and load WASM relative to import.meta.url; pre-bundling them
// into one chunk breaks those URLs, so every @aztec/* package is served from source.
const aztecEntry = createRequire(import.meta.url).resolve('@aztec/aztec.js/fields');
const aztecScope = aztecEntry.slice(0, aztecEntry.lastIndexOf('/@aztec/') + '/@aztec'.length);
const aztecPackages = readdirSync(aztecScope).map((name) => `@aztec/${name}`);

export default defineConfig({
  root: 'browser',
  plugins: [nodePolyfills({ globals: { process: true, Buffer: true } })],
  server: {
    // SharedArrayBuffer for bb.js threads needs cross-origin isolation.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: { allow: ['..', '../..', join(aztecScope, '..')] },
  },
  optimizeDeps: {
    // CommonJS dependencies of the (un-pre-bundled) aztec packages still need Vite's ESM interop.
    include: [
      'pino',
      'pino/browser',
      'detect-node',
      'buffer',
      'comlink',
      'colorette',
      'hash.js',
      'sha3',
      'idb',
      'idb-keyval',
      'json-stringify-deterministic',
      'lodash.chunk',
      'lodash.merge',
      'lodash.times',
      'msgpackr',
      'msgpackr/pack',
      'ohash',
      'pako',
    ],
    exclude: [...aztecPackages, '@aztec-foundation/aztec-standards'],
  },
  resolve: { preserveSymlinks: true },
});
