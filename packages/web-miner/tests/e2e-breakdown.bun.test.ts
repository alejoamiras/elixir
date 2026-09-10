import { describe, expect, test } from 'bun:test';
import { EXPECTED_PROOFS, type ProofMeter, proofShortfall } from '../e2e/proof-inventory.ts';
import { breakdown, type JsonReport } from '../e2e/report.ts';

const meter = (m: ProofMeter) => Buffer.from(JSON.stringify(m)).toString('base64');
const spec = (file: string, title: string, duration: number, m?: ProofMeter) => ({
  title,
  file,
  tests: [
    {
      results: [
        {
          status: 'passed',
          duration,
          attachments: m ? [{ name: 'proofs.json', body: meter(m) }] : [],
        },
      ],
    },
  ],
});

describe('the proof inventory', () => {
  const none: ProofMeter = { proofs: [], sends: [] };
  const one: ProofMeter = {
    proofs: [{ durationMs: 41_000, at: 1 }],
    sends: [{ startedAt: 1, endedAt: 900 }],
  };

  test('a title outside the inventory fails, a shortfall fails, a malformed event fails', () => {
    expect(proofShortfall('a test nobody listed', none)).toMatch(/not in the proof inventory/);
    expect(proofShortfall('a poisoned CRS cache is purged before proving', none)).toMatch(
      /0 browser proof event/,
    );
    expect(
      proofShortfall('a poisoned CRS cache is purged before proving', {
        proofs: [{ durationMs: Number.NaN, at: 1 }],
        sends: [],
      }),
    ).toMatch(/without a positive duration/);
  });

  test('what is expected passes, more than expected passes, and a zero entry passes on nothing', () => {
    expect(proofShortfall('a poisoned CRS cache is purged before proving', one)).toBeNull();
    expect(
      proofShortfall('a malformed RPC payload is rejected, not acted on', {
        proofs: [
          one.proofs[0] as ProofMeter['proofs'][number],
          one.proofs[0] as ProofMeter['proofs'][number],
        ],
        sends: [],
      }),
    ).toBeNull();
    expect(proofShortfall('a malformed RPC payload is rejected, not acted on', none)).toBeNull();
    expect(Object.values(EXPECTED_PROOFS).filter((n) => n > 0).length).toBeGreaterThanOrEqual(6);
  });
});

describe('the breakdown', () => {
  test('sums proving per spec from the attached meters and reconciles the clocks', () => {
    const report: JsonReport = {
      stats: { startTime: '2026-09-10T00:00:00Z', duration: 100_000 },
      suites: [
        {
          suites: [
            {
              specs: [
                spec('miner.e2e.ts', 'first', 60_000, {
                  proofs: [
                    { durationMs: 20_000, at: 1 },
                    { durationMs: 10_000, at: 2 },
                    { durationMs: Number.NaN, at: 3 },
                  ],
                  sends: [
                    { startedAt: 0, endedAt: 500 },
                    { startedAt: 0, endedAt: 700 },
                  ],
                }),
                spec('words.e2e.ts', 'second', 30_000),
              ],
            },
          ],
        },
      ],
    };
    const b = breakdown(
      report,
      { steps: [{ name: 'deploy', ms: 20_000 }] },
      { outerMs: 200_000, nodeReadyMs: 30_000, prebuildMs: 5_000, playwrightMs: 150_000 },
    );
    expect(b.specs.map((r) => [r.proofs, r.provingMs, r.submissionMs])).toEqual([
      [2, 30_000, 1_200],
      [0, 0, 0],
    ]);
    expect(b.testsMs).toBe(90_000);
    expect(b.provingMs).toBe(30_000);
    expect(b.provingShareOfTests).toBeCloseTo(1 / 3);
    expect(b.provingShareOfRun).toBeCloseTo(0.15);
    expect(b.playwrightOverheadMs).toBe(150_000 - 20_000 - 90_000);
    expect(b.unattributedMs).toBe(200_000 - 30_000 - 5_000 - 150_000);
  });

  test('outside the isolated runner the outer clock is unknown, not zero', () => {
    const b = breakdown({ stats: { startTime: '', duration: 0 }, suites: [] }, null, {
      outerMs: null,
      nodeReadyMs: null,
      prebuildMs: 1,
      playwrightMs: 2,
    });
    expect(b.unattributedMs).toBeNull();
    expect(b.provingShareOfRun).toBeNull();
  });
});
