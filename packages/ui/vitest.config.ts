import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    // Pure specs are *.test.ts (bun test runs them too); DOM specs are *.vitest.tsx, which bun never matches.
    include: ['src/**/*.vitest.tsx', 'src/**/*.test.ts'],
  },
});
