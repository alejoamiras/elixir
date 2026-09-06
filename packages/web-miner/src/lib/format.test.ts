import { describe, expect, test } from 'vitest';
import { amount, compact, duration } from './format';

describe('format', () => {
  test('compact and duration read the way a dashboard needs', () => {
    expect(compact(950)).toBe('950');
    expect(compact(1234)).toBe('1.2k');
    expect(compact(3_400_000)).toBe('3.4M');
    expect(duration(45)).toBe('45 s');
    expect(duration(300)).toBe('5 min');
    expect(duration(5400)).toBe('1.5 h');
    expect(duration(Number.POSITIVE_INFINITY)).toBe('—');
  });

  test('token amounts trim trailing zeros and cap the fraction', () => {
    expect(amount(4_000_000_000_000_000_000n, 18)).toBe('4');
    expect(amount(4_123_456_789_000_000_000n, 18)).toBe('4.1234');
    expect(amount(0n, 18)).toBe('0');
  });
});
