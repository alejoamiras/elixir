import { describe, expect, test } from 'bun:test';
import { retryEligible } from '../src/controller.ts';

describe('the canary retry is only for the refused tampered claim, idle, with its secret current', () => {
  const secrets = new Map([[7, '0xsecret']]);
  const retained = { secretId: 7 };

  test('idle on the refusal with the secret current: eligible', () => {
    expect(retryEligible(retained, secrets, 'idle')).toBe(true);
  });

  test('a winner that arrived after Stop was never retained: not eligible', () => {
    expect(retryEligible(null, secrets, 'idle')).toBe(false);
  });

  test('after Start the secret rotated (and the claim was dropped): not eligible, whatever the phase', () => {
    expect(retryEligible(retained, new Map([[8, '0xnext']]), 'idle')).toBe(false);
    expect(retryEligible(retained, secrets, 'mining')).toBe(false);
    expect(retryEligible(retained, secrets, 'claiming')).toBe(false);
  });
});
