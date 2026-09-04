import { describe, expect, test } from 'vitest';
import { type EpochInfo, initial, proofsPerSecond, reduce } from './reducer';

const epoch = (n: bigint, seed = 7n): EpochInfo => ({
  epoch: n,
  seed,
  target: 1n << 122n,
  openedAt: 0n,
  claims: 0,
});

describe('miner reducer', () => {
  test('start mines the open epoch with a fresh secret; stop halts', () => {
    const [s1, c1] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    expect(s1.phase).toBe('mining');
    expect(c1).toEqual([{ type: 'mine', epoch: 3n, seed: 7n, target: 1n << 122n, secretId: 1 }]);
    const [s2, c2] = reduce(s1, { type: 'stop' });
    expect(s2.phase).toBe('idle');
    expect(c2).toEqual([{ type: 'halt' }]);
    expect(reduce(s2, { type: 'stop' })[1]).toEqual([]);
  });

  test('an epoch switch mid-proof restarts on the new seed with a rotated secret and resets tickets', () => {
    let [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, { type: 'attempt', proveMs: 3000 });
    [s] = reduce(s, { type: 'attempt', proveMs: 3000 });
    expect(s.tickets).toBe(2);
    const [s2, cmds] = reduce(s, { type: 'epoch', epoch: epoch(4n, 99n) });
    expect(cmds).toEqual([
      { type: 'halt' },
      { type: 'mine', epoch: 4n, seed: 99n, target: 1n << 122n, secretId: 2 },
    ]);
    expect(s2.job?.secretId).toBe(2);
    expect(s2.tickets).toBe(0);
    // The same epoch reported again is a no-op.
    expect(reduce(s2, { type: 'epoch', epoch: epoch(4n, 99n) })[1]).toEqual([]);
  });

  test('a winner for the current job is submitted; one for a stale job or secret is discarded', () => {
    const [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    expect(reduce(s, { type: 'winner', epoch: 3n, secretId: 1 })[1]).toEqual([{ type: 'submit' }]);
    expect(reduce(s, { type: 'winner', epoch: 2n, secretId: 1 })[1]).toEqual([
      { type: 'discard', reason: 'won against a closed epoch' },
    ]);
    expect(reduce(s, { type: 'winner', epoch: 3n, secretId: 0 })[1][0]?.type).toBe('discard');
    const [claiming] = reduce(s, { type: 'winner', epoch: 3n, secretId: 1 });
    expect(claiming.phase).toBe('claiming');
    // While claiming, an epoch switch does not restart mining (the claim decides first).
    expect(reduce(claiming, { type: 'epoch', epoch: epoch(4n) })[1]).toEqual([]);
    expect(reduce(claiming, { type: 'claimed' })[0].phase).toBe('idle');
  });

  test('failures halt and keep the message; proofs/s averages the recent window', () => {
    const [s] = reduce(initial, { type: 'start', epoch: epoch(1n) });
    const [failed, cmds] = reduce(s, { type: 'failed', error: 'worker crashed' });
    expect(failed).toMatchObject({ phase: 'idle', lastError: 'worker crashed' });
    expect(cmds).toEqual([{ type: 'halt' }]);
    expect(proofsPerSecond([])).toBe(0);
    expect(proofsPerSecond([2000, 2000])).toBe(0.5);
  });
});
