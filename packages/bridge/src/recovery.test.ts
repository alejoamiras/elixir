import { describe, expect, test } from 'bun:test';
import type { Crossing } from './journal.ts';
import { asHint, MAX_RECOVERY_BYTES, parseRecoveryFile, recoveryFile } from './recovery.ts';

const PORTAL = `0x${'be'.repeat(20)}` as const;
const crossing: Crossing = {
  id: `31337:${PORTAL}:5:2:3`,
  kind: 2,
  chainId: '31337',
  portal: PORTAL,
  version: '5',
  index: 3,
  amount: '7',
  state: 'held',
  createdAt: 1,
  updatedAt: 2,
  ethAddress: `0x${'22'.repeat(20)}`,
  txHash: '0xabc',
  epoch: '3',
  witness: {
    version: '5',
    index: 3,
    kind: 2,
    amount: '7',
    aux: `0x${'11'.repeat(32)}`,
    recipientOrRedeemKey: `0x${'22'.repeat(20)}`,
    txHash: `0x${'33'.repeat(32)}`,
    epoch: '3',
    numCheckpointsInEpoch: 1,
    leafIndex: '0',
    path: [],
  },
};
const scope = { chainId: '31337', portal: PORTAL, account: '0x01' };

describe('the recovery file', () => {
  test('round-trips its crossings and witnesses, and is bound to the chain and portal', () => {
    const text = JSON.stringify(recoveryFile(scope, [crossing], 5));
    const back = parseRecoveryFile(text, { chainId: '31337', portal: PORTAL });
    expect(back.crossings).toEqual([crossing]);
    expect(back.exportedAt).toBe(5);
    expect(() => parseRecoveryFile(text, { chainId: '1', portal: PORTAL })).toThrow(/not this deployment/);
    expect(() => parseRecoveryFile(text, { chainId: '31337', portal: `0x${'00'.repeat(20)}` })).toThrow(
      /not this deployment/,
    );
  });

  test('a malformed entry names itself: a bad state, a bad id, a bad witness, a foreign version', () => {
    const file = (patch: Record<string, unknown>) =>
      JSON.stringify(recoveryFile(scope, [{ ...crossing, ...patch } as Crossing]));
    const parse = (text: string) => () => parseRecoveryFile(text, { chainId: '31337', portal: PORTAL });
    expect(parse(file({ state: 'flying' }))).toThrow(/crossing 0: state flying/);
    expect(parse(file({ id: 'other' }))).toThrow(/id other is not/);
    expect(parse(file({ witness: { ...crossing.witness, kind: 9 } }))).toThrow(/witness: kind 9/);
    expect(parse(file({ amount: '-1' }))).toThrow(/amount is missing or malformed/);
    expect(parse('{"v":2}')).toThrow(/version 2 is not 1/);
    expect(parse('nope')).toThrow(/not JSON/);
    // The card's fields and the witness the signature covers must be one crossing.
    expect(parse(file({ amount: '8' }))).toThrow(/witness does not describe/);
    expect(parse(file({ ethAddress: `0x${'33'.repeat(20)}` }))).toThrow(/witness does not describe/);
    expect(parse(`{"v":1,"pad":"${'x'.repeat(MAX_RECOVERY_BYTES)}"}`)).toThrow(/too large/);
    // A crossing of another deployment inside a file for this one is refused, not reserved.
    const { id: _id, ...foreign } = { ...crossing, portal: `0x${'cd'.repeat(20)}` as const };
    expect(parse(JSON.stringify(recoveryFile(scope, [foreign as Crossing])))).toThrow(
      /not of this deployment/,
    );
  });

  test('an ended state comes in as the furthest state its fields can be read from; the chain says how it ended', () => {
    const hint = (state: Crossing['state'], patch: Partial<Crossing> = {}) =>
      asHint({ ...crossing, ...patch, state }).state;
    expect(hint('minted-l1')).toBe('witnessed');
    expect(hint('closed', { witness: undefined })).toBe('proven-pending');
    expect(hint('closed', { witness: undefined, epoch: undefined })).toBe('sent');
    expect(hint('closed', { witness: undefined, epoch: undefined, txHash: undefined })).toBe('proving');
    expect(hint('never-proven')).toBe('witnessed');
    expect(hint('dropped', { witness: undefined, epoch: undefined, txHash: undefined })).toBe('proving');
    expect(hint('minted-l2', { kind: 3, inboxIndex: '4' })).toBe('deposited');
    expect(hint('minted-l2', { kind: 3 })).toBe('proving');
    expect(hint('minted-l2', { inboxIndex: '4', target: '6' })).toBe('forwarded');
    expect(hint('minted-l2')).toBe('witnessed');
    expect(hint('held')).toBe('held');
    expect(asHint({ ...crossing, state: 'minted-l2', claimSettled: true }).claimSettled).toBeUndefined();
    // An index sets how far a device scans: a file cannot send it past any account's reach.
    const far = JSON.stringify(
      recoveryFile(scope, [{ ...crossing, id: undefined, index: 2 ** 40 } as never]),
    );
    expect(() => parseRecoveryFile(far, { chainId: '31337', portal: PORTAL })).toThrow(/index past/);
  });
});
