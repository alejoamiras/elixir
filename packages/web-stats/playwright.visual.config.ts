import { defineConfig } from '@playwright/test';

// The fixture-only screenshot gate: no node, no global setup; the bundle and its server come from
// e2e/visual-setup.ts, the RPC answers from e2e/visual-rpc.json, the baselines from
// e2e/__screenshots__. Zero tolerance: a token's colour or a tile's padding shows. Recorded and
// checked inside the pinned Playwright image only (`bun run test:visual`); a missing baseline fails.
export default defineConfig({
  testDir: './e2e',
  testMatch: /visual\.e2e\.ts$/,
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  updateSnapshots: 'none',
  timeout: 2 * 60_000,
  expect: {
    timeout: 30_000,
    toHaveScreenshot: { threshold: 0, maxDiffPixels: 0, animations: 'disabled', caret: 'hide', scale: 'css' },
  },
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    headless: true,
    locale: 'en-US',
    timezoneId: 'UTC',
    deviceScaleFactor: 1,
    trace: 'retain-on-failure',
    launchOptions: { args: ['--disable-dev-shm-usage'] },
  },
});
