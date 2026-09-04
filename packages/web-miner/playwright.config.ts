import { defineConfig } from '@playwright/test';

// Runs under scripts/run/agent.sh (AZTEC_NODE_URL set): global setup deploys the contracts at an
// easy target on that network and starts Vite on a registry-claimed port; the spec reads both
// from e2e/.run.json. Proving in headless Chromium is slow, hence the generous timeouts.
export default defineConfig({
  testDir: './e2e',
  // Not *.spec.ts / *.test.ts: the root `bun test` would pick those up.
  testMatch: /.*\.e2e\.ts$/,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 20 * 60_000,
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--disable-dev-shm-usage'] },
  },
});
