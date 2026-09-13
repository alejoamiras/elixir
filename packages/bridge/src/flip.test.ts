import { describe, expect, test } from 'bun:test';
import { epochProven, missedDeadline, proofDeadline, type RollupReads } from './deadline.ts';
import { flipVerdict } from './flip.ts';

describe('the flip verdict', () => {
  const base = { buildVersion: 5n, registryCanonical: null, minerRetired: null, nodeVersion: null };
  test('silence is unknown; the Registry or the retired flag says flipped; both agreeing says before', () => {
    expect(flipVerdict(base)).toEqual({ kind: 'unknown' });
    expect(flipVerdict({ ...base, registryCanonical: 5n })).toEqual({ kind: 'before' });
    expect(flipVerdict({ ...base, minerRetired: false })).toEqual({ kind: 'before' });
    expect(flipVerdict({ ...base, registryCanonical: 6n })).toEqual({ kind: 'flipped', by: ['registry'] });
    expect(flipVerdict({ ...base, minerRetired: true })).toEqual({ kind: 'flipped', by: ['retired'] });
    expect(flipVerdict({ ...base, registryCanonical: 6n, minerRetired: true })).toEqual({
      kind: 'flipped',
      by: ['registry', 'retired'],
    });
    // A node for another version is a setting problem, whatever the Registry says.
    expect(flipVerdict({ ...base, registryCanonical: 5n, nodeVersion: 6n })).toEqual({
      kind: 'wrong-node',
      nodeVersion: 6n,
    });
    expect(flipVerdict({ ...base, nodeVersion: 5n })).toEqual({ kind: 'unknown' });
  });
});

describe('the proof deadline', () => {
  const rollup = (proven: bigint, epochOf: (c: bigint) => bigint): RollupReads => ({
    proofSubmissionEpochs: async () => 2n,
    timestampForEpoch: async (e) => e * 100n,
    provenCheckpoint: async () => proven,
    epochOfCheckpoint: async (c) => epochOf(c),
  });
  test('the epoch after the window; proven once the proven checkpoint reaches the epoch; missed past the deadline', async () => {
    const r = rollup(8n, (c) => c / 4n);
    expect(await proofDeadline(r, 3n)).toBe(600n);
    expect(await epochProven(r, 2n)).toBe(true);
    expect(await epochProven(r, 3n)).toBe(false);
    expect(
      await epochProven(
        rollup(0n, () => 0n),
        0n,
      ),
    ).toBe(false);
    expect(missedDeadline(600n, false, 601n)).toBe(true);
    expect(missedDeadline(600n, false, 600n)).toBe(false);
    expect(missedDeadline(600n, true, 9_000n)).toBe(false);
  });
});
