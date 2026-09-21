import { describe, expect, test } from 'bun:test';
import { rotate } from '../src/bridge/session.ts';
import { retryEligible } from '../src/controller.ts';

describe('the settlement batch rotates so no open claim waits forever', () => {
  test('nine open claims, eight per refresh: the ninth is asked about on the second refresh', () => {
    const open = Array.from({ length: 9 }, (_, i) => `c${i}`);
    const first = rotate(open, 0, 8);
    const second = rotate(open, 8, 8);
    expect(first).toEqual(['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7']);
    expect(second[0]).toBe('c8');
    expect(new Set([...first, ...second])).toEqual(new Set(open));
    expect(rotate([], 5, 8)).toEqual([]);
  });
});

describe('a retained claim is retried only idle, with its secret current and its epoch still open', () => {
  const secrets = new Map([[7, '0xsecret']]);
  const retained = { secretId: 7, epoch: 3n };

  test('idle on the failure with the secret current and the epoch open: eligible', () => {
    expect(retryEligible(retained, secrets, 'idle', 3n)).toBe(true);
  });

  test('a winner that arrived after Stop was never retained: not eligible', () => {
    expect(retryEligible(null, secrets, 'idle', 3n)).toBe(false);
  });

  test('after Start the secret rotated (and the claim was dropped): not eligible, whatever the phase', () => {
    expect(retryEligible(retained, new Map([[8, '0xnext']]), 'idle', 3n)).toBe(false);
    expect(retryEligible(retained, secrets, 'mining', 3n)).toBe(false);
    expect(retryEligible(retained, secrets, 'claiming', 3n)).toBe(false);
  });

  test('the epoch closed while idle, or is not known: the ticket is worthless, not eligible', () => {
    expect(retryEligible(retained, secrets, 'idle', 4n)).toBe(false);
    expect(retryEligible(retained, secrets, 'idle', undefined)).toBe(false);
  });
});
