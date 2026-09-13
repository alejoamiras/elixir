import { describe, expect, test } from 'bun:test';
import type { Deployment } from '../deploy.ts';
import { forwardAll, MAX_BATCH } from './forward.ts';
import type { Operator } from './operator.ts';

const source = { profile: 'never', rollupVersion: '1', nodeUrl: 'http://127.0.0.1:1' } as Deployment;

describe('forwardAll', () => {
  test('refuses a batch size that would loop or overrun a block before touching anything', async () => {
    for (const batch of [0, -1, 1.5, MAX_BATCH + 1])
      await expect(forwardAll({} as Operator, { source, batch })).rejects.toThrow(/batch must be/);
  });
});
