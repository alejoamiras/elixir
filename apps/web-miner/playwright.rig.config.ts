import { defineConfig } from '@playwright/test';

// The upgrade rig's browser case (tools/harness/tests/browser.bun.test.ts) owns the network, the
// deployments and the servers, and runs bridge.e2e.ts one stage at a time against E2E_RUN_FILE: no
// global setup here. Real proving across a flip: the stages are long.
export default defineConfig({
  testDir: './e2e',
  // The rig-only specs: the migration through the page, the versioned origin.
  testMatch: /(bridge|origin)\.e2e\.ts$/,
  // A diagnostic run may shorten a stage (RIG_STAGE_TIMEOUT_MS): the failure hook then prints the page's log.
  timeout: Number(process.env.RIG_STAGE_TIMEOUT_MS ?? 45 * 60_000),
  expect: { timeout: 60_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'e2e/.rig-report.json' }]],
  use: {
    headless: true,
    trace: 'retain-on-failure',
    // The origin case serves the apex and the versioned origin over TLS as `yacana.test` and
    // `v5.yacana.test` (WebAuthn refuses `localhost` as a suffix of `v5.localhost`, and a plain-http
    // made-up domain is no secure context): the browser resolves both to loopback and accepts the
    // run's self-signed certificate.
    ignoreHTTPSErrors: process.env.RIG_TEST_DOMAINS === '1',
    launchOptions: {
      args: [
        '--disable-dev-shm-usage',
        ...(process.env.RIG_TEST_DOMAINS === '1'
          ? ['--host-resolver-rules=MAP yacana.test 127.0.0.1, MAP *.yacana.test 127.0.0.1']
          : []),
      ],
    },
  },
});
