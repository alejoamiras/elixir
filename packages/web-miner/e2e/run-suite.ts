// `bun run test:e2e [playwright args…]`: prebuild, Playwright, then the breakdown — each on its own
// clock, so the report can say where the run's minutes went. Exits with Playwright's code.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPORT_FILE, reportRun } from './report.ts';
import { TIMINGS_FILE } from './run.ts';

const pkg = resolve(import.meta.dirname, '..');
const timed = (cmd: string[]): { code: number; ms: number } => {
  const t0 = Date.now();
  const [bin, ...args] = cmd;
  const r = spawnSync(bin as string, args, { cwd: pkg, stdio: 'inherit' });
  return { code: r.status ?? 1, ms: Date.now() - t0 };
};

// Stale files from an earlier run would masquerade as this one's.
for (const f of [REPORT_FILE, TIMINGS_FILE]) rmSync(f, { force: true });
const prebuild = timed(['bun', 'scripts/prebuild.ts']);
if (prebuild.code !== 0) process.exit(prebuild.code);
const playwright = timed(['bunx', 'playwright', 'test', ...process.argv.slice(2).filter((a) => a !== '--')]);
const startedAt = Number(process.env.YACANA_RUN_STARTED_AT);
const nodeReadyMs = Number(process.env.YACANA_NODE_READY_MS);
reportRun({
  outerMs: Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : null,
  nodeReadyMs: Number.isFinite(nodeReadyMs) && nodeReadyMs > 0 ? nodeReadyMs : null,
  prebuildMs: prebuild.ms,
  playwrightMs: playwright.ms,
});
process.exit(playwright.code);
