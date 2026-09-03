import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  root: 'browser',
  plugins: [nodePolyfills({ globals: { Buffer: true, global: true, process: true } })],
  server: {
    // SharedArrayBuffer for bb.js threads needs cross-origin isolation.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: { allow: ['..', '../..'] },
  },
  resolve: {
    alias: [
      {
        find: 'detect-node',
        replacement: fileURLToPath(new URL('./browser/shims/detect-node.ts', import.meta.url)),
      },
    ],
    // A second nested copy of either WASM binding leaves initAbi() and abiEncode() in different
    // module scopes, so the WASM instance never resolves.
    dedupe: ['@aztec/noir-noirc_abi', '@aztec/noir-acvm_js'],
  },
  optimizeDeps: {
    // CommonJS dependencies reached from the excluded packages still need Vite's ESM interop.
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
    // rewrite to a chunk that has none of them. Excluding anything that imports @aztec/foundation
    // cascades into serving foundation (and its CommonJS deps) unbundled, so nothing else goes here.
    exclude: ['@aztec/bb.js', '@aztec/noir-acvm_js', '@aztec/noir-noirc_abi', '@aztec/noir-noir_js'],
  },
});
