import { describe, expect, test } from 'bun:test';
import { Fr } from '@aztec/foundation/curves/bn254';
import {
  closePreview,
  difficulty,
  escapeHatchIn,
  nextWinSeconds,
  proofsPerMinute,
  score,
} from './metrics.ts';

const rules = { N: 4, EXPECTED_EPOCH_SECONDS: 300n, T_MAX: 1200n };

describe('metrics', () => {
  test('score is 2^128 / low128; a ticket wins when it is strictly above the difficulty', () => {
    const target = 1n << 124n; // difficulty 16
    expect(difficulty(target)).toBe(16);
    expect(score(new Fr(1n << 124n))).toBe(16); // low128 = target: not a win (the contract wants low128 < target)
    expect(score(new Fr((1n << 124n) + (1n << 120n)))).toBeCloseTo(15.06, 2);
    expect(score(new Fr(1n << 120n))).toBe(256);
    expect(score(new Fr(0n))).toBe(Number.POSITIVE_INFINITY);
    // The high bits are not part of the ticket.
    expect(score(new Fr((1n << 200n) | (1n << 124n)))).toBe(16);
  });

  test('rate is over the last 20 proofs; next win at this rate', () => {
    expect(proofsPerMinute([])).toBe(0);
    expect(proofsPerMinute([3000, 3000])).toBe(20);
    const slowThenFast = [...Array(10).fill(60_000), ...Array(20).fill(3000)];
    expect(proofsPerMinute(slowThenFast)).toBe(20);
    expect(nextWinSeconds(1n << 124n, 20)).toBe(48);
    expect(nextWinSeconds(1n << 124n, 0)).toBe(Number.POSITIVE_INFINITY);
  });

  test('close preview mirrors the retarget clamp on the elapsed time', () => {
    const target = 1n << 124n;
    expect(closePreview(target, 300n, rules)).toBeCloseTo(1);
    expect(closePreview(target, 150n, rules)).toBeCloseTo(2);
    expect(closePreview(target, 600n, rules)).toBeCloseTo(0.5);
    expect(closePreview(target, 10n, rules)).toBeCloseTo(4); // clamped
    expect(closePreview(target, 100_000n, rules)).toBeCloseTo(0.25); // capped at T_MAX, then clamped
    expect(escapeHatchIn(1000n, 1200n, 1500n)).toBe(700n);
    expect(escapeHatchIn(1000n, 1200n, 2300n)).toBe(-100n);
  });
});
