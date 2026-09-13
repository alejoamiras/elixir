import { defineConfig } from '@playwright/test';

// The upgrade rig's browser case (packages/harness/tests/browser.bun.test.ts) owns the network, the
// deployments and the servers, and runs bridge.e2e.ts one stage at a time against E2E_RUN_FILE: no
// global setup here. Real proving across a flip: the stages are long.
export default defineConfig({
  testDir: './e2e',
  testMatch: /bridge\.e2e\.ts$/,
  timeout: 45 * 60_000,
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'e2e/.rig-report.json' }]],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--disable-dev-shm-usage'] },
  },
});
