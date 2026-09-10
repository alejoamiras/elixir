import { defineConfig } from '@playwright/test';

// The replay lane: the signed-out tests against a fixture-only build whose node answers come from
// e2e/replay/recording.json. No Aztec node, no account, no proving.
export default defineConfig({
  testDir: './e2e/replay',
  testMatch: /.*\.replay\.ts$/,
  globalSetup: './e2e/replay/global-setup.ts',
  globalTeardown: './e2e/replay/global-teardown.ts',
  timeout: 3 * 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    headless: true,
    // A service worker's fetches would bypass the fixture's routing and its accounting.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    launchOptions: { args: ['--disable-dev-shm-usage'] },
  },
});
