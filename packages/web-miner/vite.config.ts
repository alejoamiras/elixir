import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// SharedArrayBuffer (bb.js threads) needs cross-origin isolation; production gets the same headers
// from public/_headers on Cloudflare Pages.
const isolation = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  server: {
    headers: isolation,
    // The hoisted node_modules (WASM binaries served via /@fs/) lives at the repo root.
    fs: { allow: [here('../..')] },
  },
  preview: { headers: isolation },
  resolve: {
    alias: [
      { find: '@', replacement: here('./src') },
      // pino probes detect-node at import time; the shim keeps it on the browser build.
      { find: 'detect-node', replacement: here('./src/shims/detect-node.ts') },
    ],
    // A second nested copy of either WASM binding leaves initAbi() and abiEncode() in different
    // module scopes, so the WASM instance never resolves.
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
    // WASM loaders resolve their binaries relative to import.meta.url, which pre-bundling would
    // rewrite to a chunk that has none of them.
    exclude: ['@aztec/bb.js', '@aztec/noir-acvm_js', '@aztec/noir-noirc_abi', '@aztec/noir-noir_js'],
  },
  worker: { format: 'es' },
  build: { target: 'esnext', sourcemap: false, chunkSizeWarningLimit: 4096 },
});
