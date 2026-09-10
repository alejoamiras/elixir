// `bun run test:e2e [playwright args…]`: prebuild, Playwright, then the breakdown — each on its own
// clock, so the report can say where the run's minutes went. Exits with Playwright's code.
// E2E_SHARD=<name> runs the files shards.json lists under that name and then requires the executed
// tests to be exactly those files' inventory: Playwright is silent when a shard matches nothing,
// and a skipped test leaves its exit code green.
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { titlesOf } from './proof-inventory.ts';
import { coverageGap, executedTitles, REPORT_FILE, reportRun } from './report.ts';
import { TIMINGS_FILE } from './run.ts';

const pkg = resolve(import.meta.dirname, '..');
const timed = (cmd: string[]): { code: number; ms: number } => {
  const t0 = Date.now();
  const [bin, ...args] = cmd;
  const r = spawnSync(bin as string, args, { cwd: pkg, stdio: 'inherit' });
  return { code: r.status ?? 1, ms: Date.now() - t0 };
};

export const shardFiles = (name: string): string[] => {
  const shards = JSON.parse(readFileSync(resolve(pkg, 'e2e/shards.json'), 'utf8')) as Record<
    string,
    string[]
  >;
  const files = shards[name];
  if (!files)
    throw new Error(`E2E_SHARD=${name}: not in e2e/shards.json (${Object.keys(shards).join(', ')})`);
  return files;
};

const shard = process.env.E2E_SHARD;
const files = shard ? shardFiles(shard) : [];
// Stale files from an earlier run would masquerade as this one's.
for (const f of [REPORT_FILE, TIMINGS_FILE]) rmSync(f, { force: true });
const prebuild = timed(['bun', 'scripts/prebuild.ts']);
if (prebuild.code !== 0) process.exit(prebuild.code);
const args = process.argv.slice(2).filter((a) => a !== '--');
const playwright = timed(['bunx', 'playwright', 'test', ...files, ...args]);
const startedAt = Number(process.env.YACANA_RUN_STARTED_AT);
const nodeReadyMs = Number(process.env.YACANA_NODE_READY_MS);
const b = reportRun({
  outerMs: Number.isFinite(startedAt) && startedAt > 0 ? Date.now() - startedAt : null,
  nodeReadyMs: Number.isFinite(nodeReadyMs) && nodeReadyMs > 0 ? nodeReadyMs : null,
  prebuildMs: prebuild.ms,
  playwrightMs: playwright.ms,
});
if (shard) {
  const gap = coverageGap(executedTitles(b.specs), titlesOf(files));
  if (gap.missing.length || gap.unexpected.length) {
    console.error(
      `shard ${shard} did not execute its inventory — missing: ${JSON.stringify(gap.missing)}; unexpected: ${JSON.stringify(gap.unexpected)}`,
    );
    process.exit(playwright.code || 1);
  }
  console.log(`shard ${shard}: all ${titlesOf(files).length} tests of ${files.join(', ')} executed`);
}
process.exit(playwright.code);
