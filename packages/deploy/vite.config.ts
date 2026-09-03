import { defineConfig, type Plugin } from 'vite';
import { nodePolyfills, type PolyfillOptions } from 'vite-plugin-node-polyfills';

// vite-plugin-node-polyfills resolves its shims relative to the plugin, which breaks under an
// isolated node_modules layout; pin them explicitly (same workaround as Aztec's webapp tutorial).
const nodePolyfillsFix = (options?: PolyfillOptions): Plugin => ({
  ...nodePolyfills(options),
  resolveId(source: string) {
    const m = /^vite-plugin-node-polyfills\/shims\/(buffer|global|process)$/.exec(source);
    if (m) return `./node_modules/vite-plugin-node-polyfills/shims/${m[1]}/dist/index.cjs`;
  },
});

export default defineConfig({
  root: 'browser',
  plugins: [nodePolyfillsFix({ globals: { process: true, Buffer: true } })],
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
