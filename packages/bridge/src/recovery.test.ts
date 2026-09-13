import { describe, expect, test } from 'bun:test';
import type { Crossing } from './journal.ts';
import { parseRecoveryFile, recoveryFile, supersedes } from './recovery.ts';

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
  });

  test('a restored crossing replaces the journal’s only when the file knows the end and the journal does not', () => {
    const claimed: Crossing = { ...crossing, state: 'minted-l2' };
    const found: Crossing = { ...crossing, state: 'deposited', updatedAt: 9 };
    expect(supersedes(claimed, found)).toBe(true);
    expect(supersedes(found, claimed)).toBe(false);
    expect(supersedes(found, crossing)).toBe(false);
    expect(supersedes(claimed, { ...crossing, state: 'dropped' })).toBe(false);
  });
});
