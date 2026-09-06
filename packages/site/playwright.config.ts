import { defineConfig } from '@playwright/test';

// Runs under scripts/run/agent.sh (AZTEC_NODE_URL set): global setup deploys the contracts on that
// network, assembles the site in e2e mode and serves it with `wrangler pages dev` on a registry-claimed port.
export default defineConfig({
  testDir: './e2e',
  // Not *.spec.ts / *.test.ts: the root `bun test` would pick those up.
  testMatch: /.*\.e2e\.ts$/,
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  timeout: 5 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--disable-dev-shm-usage'] },
  },
});
