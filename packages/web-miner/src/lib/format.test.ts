import { describe, expect, test } from 'vitest';
import { amount, compact, difficulty, duration, expectedSecondsToWin } from './format';

describe('format', () => {
  test('difficulty is 2^128 / target', () => {
    expect(difficulty(1n << 127n)).toBe(2);
    expect(difficulty(1n << 122n)).toBe(64);
    expect(difficulty(1n << 124n)).toBe(16);
  });

  test('expected time to win follows the hashrate', () => {
    expect(expectedSecondsToWin(1n << 122n, 0.25)).toBe(256);
    expect(expectedSecondsToWin(1n << 122n, 0)).toBe(Number.POSITIVE_INFINITY);
    expect(duration(expectedSecondsToWin(1n << 122n, 0))).toBe('—');
  });

  test('compact and duration read the way a dashboard needs', () => {
    expect(compact(950)).toBe('950');
    expect(compact(1234)).toBe('1.2k');
    expect(compact(3_400_000)).toBe('3.4M');
    expect(duration(45)).toBe('45 s');
    expect(duration(300)).toBe('5 min');
    expect(duration(5400)).toBe('1.5 h');
  });

  test('token amounts trim trailing zeros and cap the fraction', () => {
    expect(amount(4_000_000_000_000_000_000n, 18)).toBe('4');
    expect(amount(4_123_456_789_000_000_000n, 18)).toBe('4.1234');
    expect(amount(0n, 18)).toBe('0');
  });
});
