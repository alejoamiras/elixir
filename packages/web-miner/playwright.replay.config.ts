import { defineConfig } from '@playwright/test';

// The replay lane: the three signed-out tests against a fixture-only build whose node answers come
// from e2e/replay/recording.json. No network, no account, no proving — minutes, not tens of them.
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
    trace: 'retain-on-failure',
    launchOptions: { args: ['--disable-dev-shm-usage'] },
  },
});
