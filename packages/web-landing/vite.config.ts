import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { siteVite } from '../site/src/vite-base.ts';

// The landing reads the chain and draws; nothing of bb.js ships with it (the E2E asserts it).
export default defineConfig(siteVite({ root: fileURLToPath(new URL('.', import.meta.url)), prover: false }));
