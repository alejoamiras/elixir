// The run's breakdown: where the minutes went, from Playwright's JSON report, the rig timings
// run-setup left behind and the clocks around them, with the browser's own transaction proving
// apart from everything else. Written to decide what is worth speeding up, and reconciled against
// the outer wall clock so unattributed time shows rather than hides.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { type ProofMeter, wellFormed } from './proof-inventory.ts';
import { type RigTimings, TIMINGS_FILE } from './run.ts';

const pkg = resolve(import.meta.dirname, '..');
export const REPORT_FILE = resolve(pkg, 'e2e/.report.json');
const BREAKDOWN_FILE = resolve(pkg, 'e2e/.breakdown.json');

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

const specsOf = (s: JsonSuite): JsonSpec[] => [...(s.specs ?? []), ...(s.suites ?? []).flatMap(specsOf)];

const meterOf = (result: JsonResult | undefined): ProofMeter => {
  const body = result?.attachments.find((a) => a.name === 'proofs.json')?.body;
  return body
    ? (JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as ProofMeter)
    : { proofs: [], sends: [] };
};

/** One row per spec from its last result (a retry replaces its predecessor). */
export function specRows(report: JsonReport): SpecRow[] {
  return report.suites.flatMap(specsOf).map((spec) => {
    const result = spec.tests.at(-1)?.results.at(-1);
    const meter = meterOf(result);
    const proofs = meter.proofs.filter(wellFormed);
    return {
      file: spec.file,
      title: spec.title,
      status: result?.status ?? 'missing',
      ms: result?.duration ?? 0,
      proofs: proofs.length,
      provingMs: proofs.reduce((n, p) => n + p.durationMs, 0),
      submissionMs: meter.sends.reduce((n, s) => n + (s.endedAt - s.startedAt), 0),
    };
  });
}

const sum = (xs: number[]) => xs.reduce((n, x) => n + x, 0);

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
    // Playwright's process minus what setup and the tests account for: launch, teardown, the gaps.
    playwrightOverheadMs: clocks.playwrightMs - rigMs - testsMs,
    // The outer clock minus every part measured: what the instrument did not see.
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

export function render(b: Breakdown): string {
  const c = b.clocks;
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
    `Rig (network + prebuild + setup): **${s((c.nodeReadyMs ?? 0) + c.prebuildMs + b.rigMs)}**, ` +
      `${pct((c.nodeReadyMs ?? 0) + c.prebuildMs + b.rigMs, c.outerMs)} of the run. ` +
      `Browser transaction proving: **${s(b.provingMs)}**, ${pct(b.provingMs, b.testsMs)} of test time, ` +
      `${pct(b.provingMs, c.outerMs)} of the run; submission round trips ${s(b.submissionMs)}.`,
    '',
    '| spec | status | time | proofs | proving | submission |',
    '|---|---|---|---|---|---|',
    ...b.specs.map(
      (r) =>
        `| ${r.file} › ${r.title.slice(0, 56)} | ${r.status} | ${s(r.ms)} | ${r.proofs} | ${s(r.provingMs)} | ${s(r.submissionMs)} |`,
    ),
    '',
  ].join('\n');
}

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
  const text = render(b);
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  return b;
}
