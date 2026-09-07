import { defineConfig } from '@playwright/test';

// Zero-tolerance captures are only comparable inside the pinned Playwright image (`bun run
// test:visual`): Chromium and the text stack are half of every baseline. A missing baseline fails.
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
