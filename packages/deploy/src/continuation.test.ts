// The by-hand continuation: the announced epoch, seed and target travel together into the deploy,
// so a continuation never restarts the difficulty schedule at the profile's initial target.
import { afterEach, describe, expect, test } from 'bun:test';
import { PROFILE } from '../../miner-core/src/generated/params.ts';
import { continuationOf } from './deploy.ts';

const SOURCE = `deployments/${PROFILE}.json`;
const KEYS = ['YACANA_CONTINUE_FIRST_EPOCH', 'YACANA_CONTINUE_SEED', 'YACANA_CONTINUE_TARGET'] as const;
const announced = { first: '42', seed: '0x1234', target: (1n << 120n).toString() };

afterEach(() => {
  for (const k of KEYS) delete process.env[k];
});

describe('continuationOf by hand', () => {
  test('carries the announced epoch, seed and target', async () => {
    process.env.YACANA_CONTINUE_FIRST_EPOCH = announced.first;
    process.env.YACANA_CONTINUE_SEED = announced.seed;
    process.env.YACANA_CONTINUE_TARGET = announced.target;
    const c = await continuationOf(SOURCE);
    expect(c.firstEpoch).toBe(42n);
    expect(c.sourceSeed.toBigInt()).toBe(0x1234n);
    expect(c.sourceTarget).toBe(1n << 120n);
    expect(c.source).toBe(SOURCE);
  });

  test('refuses an announcement missing its target', async () => {
    process.env.YACANA_CONTINUE_FIRST_EPOCH = announced.first;
    process.env.YACANA_CONTINUE_SEED = announced.seed;
    await expect(continuationOf(SOURCE)).rejects.toThrow(/go together/);
  });
});
