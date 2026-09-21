import { describe, expect, test } from 'bun:test';
import type { ArchivedExit, RecordedExit } from '@yacana/bridge/witness';
import type { Deployment } from '../deploy.ts';
import { forwardAll, MAX_BATCH, sameExit } from './forward.ts';
import type { Operator } from './operator.ts';

const source = { profile: 'never', rollupVersion: '1', nodeUrl: 'http://127.0.0.1:1' } as Deployment;
const exit: RecordedExit = {
  index: 4,
  kind: 2,
  amount: 5n,
  aux: `0x${'11'.repeat(32)}`,
  recipientOrRedeemKey: '0x000000000000000000000000000000000000BEEF',
  txHash: `0x${'22'.repeat(32)}`,
};
const line = {
  ...exit,
  version: '1',
  amount: '5',
  recipientOrRedeemKey: '0x000000000000000000000000000000000000beef',
  epoch: '3',
  numCheckpointsInEpoch: 1,
  leafIndex: '0',
  path: [],
} as ArchivedExit;

describe('forwardAll', () => {
  test('refuses a batch size that would loop or overrun a block before touching anything', async () => {
    for (const batch of [0, -1, 1.5, MAX_BATCH + 1])
      await expect(forwardAll({} as Operator, { source, batch })).rejects.toThrow(/batch must be/);
  });

  test('an archive line stands for the exit at its index only when it is that exit', () => {
    expect(sameExit(line, exit)).toBe(true);
    expect(sameExit({ ...line, txHash: `0x${'33'.repeat(32)}` }, exit)).toBe(false);
    expect(sameExit({ ...line, amount: '6' }, exit)).toBe(false);
    expect(sameExit({ ...line, kind: 1 }, exit)).toBe(false);
    expect(sameExit({ ...line, aux: `0x${'12'.repeat(32)}` }, exit)).toBe(false);
  });
});
