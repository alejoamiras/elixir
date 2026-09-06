import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { siteVite } from '../site/src/vite-base.ts';

// The demo proves in the miner's Worker, so the landing carries the bb.js plumbing; the Worker
// chunk is fetched on the click, never with the page (the E2E asserts it).
export default defineConfig(siteVite({ root: fileURLToPath(new URL('.', import.meta.url)), prover: true }));
