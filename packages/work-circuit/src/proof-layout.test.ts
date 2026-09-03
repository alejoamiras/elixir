// The ticket digest is defined against this manifest, so the committed file is pinned by hash:
// a toolchain bump that changes the layout must be a deliberate regeneration, not drift.
import { describe, expect, test } from 'bun:test';
import { resolve } from 'node:path';
import layout from './generated/proof-layout.json';

const PINNED_SHA256 = '2c913f7e65b40f9d706c5badaeb3122525c41d8e2a4b976ed0122883e9b7f6c3';

describe('proof-layout manifest', () => {
  test('has 410 contiguous slots in the bb 5.2.0 phase order', () => {
    expect(layout.aztecVersion).toBe('5.2.0');
    expect(layout.slots).toHaveLength(410);
    for (const [i, s] of layout.slots.entries()) expect(s.index).toBe(i);
    expect(Object.entries(layout.phases).map(([k, v]) => [k, v.from, v.count])).toEqual([
      ['io', 0, 8],
      ['oink', 8, 32],
      ['sumcheck_univariates', 40, 200],
      ['sumcheck_evaluations', 240, 41],
      ['gemini_folds', 281, 96],
      ['gemini_evals', 377, 25],
      ['shplonk', 402, 4],
      ['kzg', 406, 4],
    ]);
  });

  test('is byte-identical to the pinned generation', async () => {
    const file = await Bun.file(resolve(import.meta.dir, 'generated', 'proof-layout.json')).arrayBuffer();
    expect(new Bun.CryptoHasher('sha256').update(file).digest('hex')).toBe(PINNED_SHA256);
  });
});
