// Vite bundles Workers with their own plugin list and never runs vite-plugin-node-polyfills'
// global injection for them, so a production Worker has no Buffer or process while the aztec
// packages touch both at module scope. Import this before anything else in every Worker entry.
import { Buffer } from 'vite-plugin-node-polyfills/shims/buffer';
import { process } from 'vite-plugin-node-polyfills/shims/process';

const g = globalThis as { Buffer?: unknown; process?: unknown; global?: unknown };
g.Buffer ??= Buffer;
g.process ??= process;
g.global ??= globalThis;
