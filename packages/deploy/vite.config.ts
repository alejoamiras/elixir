import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  root: 'browser',
  plugins: [nodePolyfills({ globals: { process: true, Buffer: true } })],
  server: {
    // SharedArrayBuffer for bb.js threads needs cross-origin isolation.
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
    fs: { allow: ['..', '../..'] },
  },
  optimizeDeps: {
    include: ['pino', 'pino/browser'],
    exclude: ['@aztec/noir-noirc_abi', '@aztec/noir-acvm_js', '@aztec/bb.js', '@aztec/noir-noir_js'],
  },
  resolve: { preserveSymlinks: true },
});
