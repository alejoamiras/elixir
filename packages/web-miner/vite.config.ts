import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { siteVite } from '../site/src/vite-base.ts';

export default defineConfig(siteVite({ root: fileURLToPath(new URL('.', import.meta.url)), prover: true }));
