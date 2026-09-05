import { describe, expect, test } from 'bun:test';
import { classifyClaimFailure } from './claim-failure.ts';

// The strings aztec.js 5.2.0 and the PXE produce (utils/node.js waitForTx; the tagging sync).
const FIXTURES: [string, ReturnType<typeof classifyClaimFailure>][] = [
  ['Invalid tx: Invalid expiration timestamp', 'expired'],
  ['Transaction 0x0a1b was dropped. Reason: Invalid expiration timestamp', 'expired'],
  ['Transaction 0x0a1b was dropped. Reason: Tx dropped by P2P node: include_by_timestamp passed', 'expired'],
  ['Transaction 0x0a1b was dropped. Reason: Existing nullifier', 'other'],
  ['Transaction 0x0a1b was dropped. Reason: unknown', 'other'],
  ['Transaction 0x0a1b reverted: app_logic_reverted. Reason: Assertion failed: epoch closed', 'reverted'],
  ['Transaction 0x0a1b reverted: both_reverted. Reason: unknown', 'reverted'],
  ['Simulation error: Nullifier read request failed for note 0x…', 'delivery-blocked'],
  ['unknown nullifier 0x12', 'delivery-blocked'],
  ['fetch failed', 'other'],
  ['', 'other'],
];

describe('classifyClaimFailure', () => {
  test.each(FIXTURES)('%s → %s', (message, expected) => {
    expect(classifyClaimFailure(new Error(message))).toBe(expected);
  });
  test('non-Error values are classified from their string form', () => {
    expect(classifyClaimFailure('Invalid expiration timestamp')).toBe('expired');
    expect(classifyClaimFailure({})).toBe('other');
  });
});
