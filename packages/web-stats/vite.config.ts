import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { siteVite } from '../web-kit/src/vite-base.ts';

export default defineConfig(siteVite({ root: fileURLToPath(new URL('.', import.meta.url)), prover: false }));
