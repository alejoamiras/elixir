// The run's breakdown: where the minutes went, from Playwright's JSON report, the rig timings
// run-setup left behind and the clocks around them, with the browser's own transaction proving
// apart from everything else. Written to decide what is worth speeding up, and reconciled against
// the outer wall clock so unattributed time shows rather than hides.
//   bun e2e/report.ts merge <dir>   # every shard's .breakdown.json under <dir> into one table
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type ProofMeter, SPEC_FILES, titlesOf, wellFormed } from './proof-inventory.ts';
import { type RigTimings, TIMINGS_FILE } from './run.ts';

const pkg = resolve(import.meta.dirname, '..');
export const REPORT_FILE = resolve(pkg, 'e2e/.report.json');
export const BREAKDOWN_FILE = resolve(pkg, 'e2e/.breakdown.json');

interface JsonAttachment {
  name: string;
  body?: string;
}
interface JsonResult {
  status: string;
  duration: number;
  attachments: JsonAttachment[];
}
interface JsonSpec {
  title: string;
  file: string;
  tests: { results: JsonResult[] }[];
}
interface JsonSuite {
  suites?: JsonSuite[];
  specs?: JsonSpec[];
}
export interface JsonReport {
  suites: JsonSuite[];
  stats: { startTime: string; duration: number };
}

export interface SpecRow {
  file: string;
  title: string;
  /** Playwright's last result; `missing` when the spec never ran. */
  status: string;
  ms: number;
  proofs: number;
  provingMs: number;
  submissionMs: number;
}

/** The clocks around Playwright: the outer runner's, prebuild's, and the Playwright process's own. */
export interface Clocks {
  /** From the isolated network's launch (`YACANA_RUN_STARTED_AT`) to the report; null outside `e2e:agent`. */
  outerMs: number | null;
  nodeReadyMs: number | null;
  prebuildMs: number;
  playwrightMs: number;
}

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);
const specsOf = (s: JsonSuite): JsonSpec[] => [...(s.specs ?? []), ...(s.suites ?? []).flatMap(specsOf)];

const meterOf = (result: JsonResult): ProofMeter => {
  const body = result.attachments.find((a) => a.name === 'proofs.json')?.body;
  return body
    ? (JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as ProofMeter)
    : { proofs: [], sends: [] };
};

/** One row per spec: the last attempt's status, every attempt's time and proofs (a retry cost the run too). */
export function specRows(report: JsonReport): SpecRow[] {
  return report.suites.flatMap(specsOf).map((spec) => {
    const attempts = spec.tests.flatMap((t) => t.results);
    const meters = attempts.map(meterOf);
    const proofs = meters.flatMap((m) => m.proofs).filter(wellFormed);
    return {
      file: spec.file,
      title: spec.title,
      status: attempts.at(-1)?.status ?? 'missing',
      ms: sum(attempts.map((a) => a.duration)),
      proofs: proofs.length,
      provingMs: sum(proofs.map((p) => p.durationMs)),
      submissionMs: sum(meters.flatMap((m) => m.sends).map((s) => s.endedAt - s.startedAt)),
    };
  });
}

/** A test counts as executed when its body ran to a verdict; skipped and never-run ones do not. */
const EXECUTED = new Set(['passed', 'failed', 'timedOut', 'interrupted']);
export const executedTitles = (rows: readonly SpecRow[]): string[] =>
  rows.filter((r) => EXECUTED.has(r.status)).map((r) => r.title);

/** Titles expected but not executed, and executed but not expected; both empty when the run covered its claim. */
export function coverageGap(executed: readonly string[], expected: readonly string[]) {
  const ran = new Set(executed);
  const want = new Set(expected);
  return {
    missing: expected.filter((t) => !ran.has(t)),
    unexpected: executed.filter((t) => !want.has(t)),
  };
}

export function breakdown(report: JsonReport, rig: RigTimings | null, clocks: Clocks) {
  const specs = specRows(report);
  const testsMs = sum(specs.map((r) => r.ms));
  const provingMs = sum(specs.map((r) => r.provingMs));
  const rigMs = sum((rig?.steps ?? []).map((s) => s.ms));
  const accounted = (clocks.nodeReadyMs ?? 0) + clocks.prebuildMs + clocks.playwrightMs;
  return {
    clocks,
    rig: rig?.steps ?? [],
    rigMs,
    testsMs,
    playwrightRunMs: report.stats.duration,
    // Launch, teardown and the gaps between serial tests — and anything inside Playwright that the
    // rig laps and the test durations fail to attribute; it cannot tell those apart.
    playwrightOverheadMs: clocks.playwrightMs - rigMs - testsMs,
    // Zero means the wrapper's three clocks tile the outer one, nothing more: the outer clock stops
    // at the report, before the isolated network's teardown.
    unattributedMs: clocks.outerMs === null ? null : clocks.outerMs - accounted,
    provingMs,
    submissionMs: sum(specs.map((r) => r.submissionMs)),
    provingShareOfTests: testsMs ? provingMs / testsMs : 0,
    provingShareOfRun: clocks.outerMs ? provingMs / clocks.outerMs : null,
    specs,
  };
}
export type Breakdown = ReturnType<typeof breakdown>;

const s = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)}s`);
const pct = (part: number, whole: number | null) => (whole ? `${((100 * part) / whole).toFixed(1)}%` : '—');
const specLine = (r: SpecRow) =>
  `| ${r.file} › ${r.title.slice(0, 56)} | ${r.status} | ${s(r.ms)} | ${r.proofs} | ${s(r.provingMs)} | ${s(r.submissionMs)} |`;
const SPEC_HEAD = ['| spec | status | time | proofs | proving | submission |', '|---|---|---|---|---|---|'];

export function render(b: Breakdown): string {
  const c = b.clocks;
  const rig = (c.nodeReadyMs ?? 0) + c.prebuildMs + b.rigMs;
  return [
    '## e2e breakdown',
    '',
    '| step | time |',
    '|---|---|',
    `| isolated network ready (before Playwright) | ${s(c.nodeReadyMs)} |`,
    `| prebuild (CRS, artifacts, slots) | ${s(c.prebuildMs)} |`,
    ...b.rig.map((st) => `| rig · ${st.name} | ${s(st.ms)} |`),
    `| **tests** | **${s(b.testsMs)}** |`,
    `| Playwright launch, teardown and gaps | ${s(b.playwrightOverheadMs)} |`,
    `| Playwright process | ${s(c.playwrightMs)} |`,
    `| unattributed on the outer clock | ${s(b.unattributedMs)} |`,
    `| **whole run** | **${s(c.outerMs)}** |`,
    '',
    `Rig (network + prebuild + setup): **${s(rig)}**, ${pct(rig, c.outerMs)} of the run. ` +
      `Browser transaction proving: **${s(b.provingMs)}**, ${pct(b.provingMs, b.testsMs)} of test time, ` +
      `${pct(b.provingMs, c.outerMs)} of the run; submission round trips ${s(b.submissionMs)}.`,
    '',
    ...SPEC_HEAD,
    ...b.specs.map(specLine),
    '',
  ].join('\n');
}

const summary = (text: string) => {
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
};

/** Reads the report and the timings, writes `.breakdown.json`, prints the table (and the job summary in CI). */
export function reportRun(clocks: Clocks): Breakdown {
  if (!existsSync(REPORT_FILE))
    throw new Error(`${REPORT_FILE} is missing: Playwright did not write its report`);
  const report = JSON.parse(readFileSync(REPORT_FILE, 'utf8')) as JsonReport;
  const rig = existsSync(TIMINGS_FILE)
    ? (JSON.parse(readFileSync(TIMINGS_FILE, 'utf8')) as RigTimings)
    : null;
  const b = breakdown(report, rig, clocks);
  writeFileSync(BREAKDOWN_FILE, `${JSON.stringify(b, null, 2)}\n`);
  summary(render(b));
  return b;
}

const findBreakdowns = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? findBreakdowns(join(dir, e.name))
      : e.name === '.breakdown.json'
        ? [join(dir, e.name)]
        : [],
  );

/** The budgets the sharding was sized against: the slowest shard job, and the matrix's runner minutes. */
export const SHARD_BUDGET = { slowestMin: 15, totalMin: 45 };

export interface ActionsJob {
  name: string;
  status: string;
  startedAt: string;
  completedAt: string;
}

/**
 * The named shards' job clocks. Only completed jobs count: the report job asks while it is itself
 * running, and `gh` prints an unfinished job's end as year 1, which parses.
 */
export const shardJobMinutes = (
  jobs: readonly ActionsJob[],
  shards: readonly string[],
): { name: string; minutes: number }[] => {
  const wanted = new Set(shards.map((s) => `web-miner · ${s}`));
  return jobs
    .filter((j) => wanted.has(j.name) && j.status === 'completed')
    .map((j) => ({
      name: j.name.replace('web-miner · ', ''),
      minutes: (Date.parse(j.completedAt) - Date.parse(j.startedAt)) / 60_000,
    }));
};

/** The run's jobs from the Actions API, when a token is at hand; null otherwise. */
function actionsJobs(): ActionsJob[] | null {
  const run = process.env.GITHUB_RUN_ID;
  if (!run || !process.env.GH_TOKEN) return null;
  try {
    const out = execFileSync('gh', ['run', 'view', run, '--json', 'jobs'], { encoding: 'utf8' });
    return (JSON.parse(out) as { jobs: ActionsJob[] }).jobs;
  } catch {
    return null;
  }
}

/** The budget line, with a workflow warning when a budget is over: evidence, not a gate. */
function budgetLine(jobs: { name: string; minutes: number }[]): string {
  const total = sum(jobs.map((j) => j.minutes));
  const slowest = Math.max(...jobs.map((j) => j.minutes));
  const over = [
    ...(slowest > SHARD_BUDGET.slowestMin
      ? [`slowest shard ${slowest.toFixed(1)} > ${SHARD_BUDGET.slowestMin} min`]
      : []),
    ...(total > SHARD_BUDGET.totalMin
      ? [`runner minutes ${total.toFixed(1)} > ${SHARD_BUDGET.totalMin}`]
      : []),
  ];
  if (over.length) console.log(`::warning::e2e shards over budget: ${over.join('; ')}`);
  return (
    `Runner minutes: **${total.toFixed(1)}** over the shard jobs (budget ${SHARD_BUDGET.totalMin}); ` +
    `slowest **${slowest.toFixed(1)} min** (budget ${SHARD_BUDGET.slowestMin}): ` +
    `${jobs.map((j) => `${j.name} ${j.minutes.toFixed(1)}`).join(', ')}.` +
    (over.length ? ` **Over budget**: ${over.join('; ')}.` : '')
  );
}

/** Every shard's breakdown under `dir` as one table; the executed tests must be the whole inventory. */
export function mergeShards(dir: string): { ok: boolean; text: string } {
  const shards = findBreakdowns(dir)
    .map((f) => ({ file: f, b: JSON.parse(readFileSync(f, 'utf8')) as Breakdown }))
    .sort((a, b) => a.file.localeCompare(b.file));
  const specs = shards.flatMap((x) => x.b.specs);
  const gap = coverageGap(executedTitles(specs), titlesOf(SPEC_FILES));
  const testsMs = sum(specs.map((r) => r.ms));
  const provingMs = sum(specs.map((r) => r.provingMs));
  const shardNames = shards.map((x) => x.file.match(/web-miner-e2e-([^/]+)\//)?.[1] ?? '');
  const apiJobs = actionsJobs();
  const jobs = apiJobs && shardJobMinutes(apiJobs, shardNames);
  const lines = [
    '## e2e · the whole suite',
    '',
    '| shard | whole run | tests | proving |',
    '|---|---|---|---|',
    ...shards.map(
      (x) =>
        `| ${x.file.split('/').find((p) => p.startsWith('web-miner-e2e-')) ?? x.file} | ${s(x.b.clocks.outerMs)} | ${s(x.b.testsMs)} | ${s(x.b.provingMs)} |`,
    ),
    '',
    `${shards.length} shard(s), ${specs.length} tests: tests **${s(testsMs)}**, browser proving **${s(provingMs)}** (${pct(provingMs, testsMs)} of test time).`,
    jobs?.length ? budgetLine(jobs) : 'Runner minutes: not read (no GH_TOKEN / GITHUB_RUN_ID).',
    gap.missing.length || gap.unexpected.length
      ? `**Coverage gap** — not executed: ${gap.missing.map((t) => `"${t}"`).join(', ') || 'none'}; unexpected: ${gap.unexpected.map((t) => `"${t}"`).join(', ') || 'none'}.`
      : `Coverage: every one of the inventory's ${titlesOf(SPEC_FILES).length} tests executed, nothing else.`,
    '',
    ...SPEC_HEAD,
    ...specs.map(specLine),
    '',
  ];
  return { ok: gap.missing.length === 0 && gap.unexpected.length === 0, text: lines.join('\n') };
}

if (import.meta.main) {
  const [mode, dir] = process.argv.slice(2);
  if (mode !== 'merge' || !dir) throw new Error('usage: bun e2e/report.ts merge <dir>');
  const { ok, text } = mergeShards(resolve(dir));
  summary(text);
  if (!ok) {
    console.error('the executed tests are not the inventory');
    process.exit(1);
  }
}
