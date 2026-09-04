import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// public/_headers is the source of truth (Cloudflare Pages applies it in production). The dev and
// preview servers send the same headers, with connect-src widened to local nodes only, so an E2E
// page runs under the production policy: the CRS CDN hosts are blocked there too.
function productionHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const line of readFileSync(here('./public/_headers'), 'utf8').split('\n')) {
    const m = line.match(/^\s+([A-Za-z-]+):\s*(.+)$/);
    if (m) headers[m[1] as string] = m[2] as string;
  }
  const csp = headers['Content-Security-Policy'];
  if (csp)
    headers['Content-Security-Policy'] = csp.replace(
      /connect-src ([^;]+)/,
      'connect-src $1 http://127.0.0.1:* http://localhost:*',
    );
  return headers;
}
const headers = productionHeaders();
// The dev server injects inline scripts (React refresh preamble, HMR client); the built bundle has none.
const devHeaders = {
  ...headers,
  'Content-Security-Policy': (headers['Content-Security-Policy'] ?? '').replace(
    "script-src 'self'",
    "script-src 'self' 'unsafe-inline'",
  ),
};

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
  ],
  server: {
    headers: devHeaders,
    // The hoisted node_modules (WASM binaries served via /@fs/) lives at the repo root.
    fs: { allow: [here('../..')] },
  },
  preview: { headers },
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
