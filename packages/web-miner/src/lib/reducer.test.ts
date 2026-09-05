import { describe, expect, test } from 'vitest';
import { proofsPerMinute } from '../../../miner-core/src/metrics.ts';
import { type EpochInfo, initial, reduce } from './reducer';

const epoch = (n: bigint, seed = 7n): EpochInfo => ({
  epoch: n,
  seed,
  target: 1n << 122n,
  openedAt: 0n,
  claims: 0,
});

const attempt = (score: number, t = 0, win = false) =>
  ({ type: 'attempt', proveMs: 3000, score, win, at: 1_700_000_000_000 + t, t }) as const;

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

  test('an epoch switch mid-proof restarts on the new seed with a rotated secret; tickets and best reset', () => {
    let [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, attempt(3.9));
    [s] = reduce(s, attempt(29.8));
    expect(s).toMatchObject({ tickets: 2, proofs: 2, best: 29.8 });
    const [s2, cmds] = reduce(s, { type: 'epoch', epoch: epoch(4n, 99n), difficultyRatio: 0.96 });
    expect(cmds).toEqual([
      { type: 'halt' },
      { type: 'mine', epoch: 4n, seed: 99n, target: 1n << 122n, secretId: 2 },
    ]);
    expect(s2).toMatchObject({ tickets: 0, best: null, proofs: 2 });
    expect(s2.job?.secretId).toBe(2);
    expect(s2.ledger[0]).toMatchObject({ kind: 'epoch', text: 'epoch 4 opened (×0.96) · new secret' });
    // The same epoch reported again is a no-op.
    expect(reduce(s2, { type: 'epoch', epoch: epoch(4n, 99n) })[1]).toEqual([]);
  });

  test('the ledger records attempts, wins, mints and failures newest first, 200 lines deep', () => {
    let [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, attempt(1.2));
    [s] = reduce(s, attempt(29.8));
    [s] = reduce(s, attempt(3.9));
    expect(s.ledger.map((l) => l.kind)).toEqual(['attempt', 'attempt', 'attempt']);
    expect(s.ledger[1]).toMatchObject({ n: 2, score: 29.8, best: true });
    expect(s.ledger[0]).toMatchObject({ n: 3, score: 3.9, best: false });
    [s] = reduce(s, attempt(51.4, 9000, true));
    expect(s.ledger[0]).toMatchObject({ kind: 'win', n: 4, score: 51.4 });
    expect(s.winAt).toBe(9000);
    [s] = reduce(s, { type: 'winner', epoch: 3n, secretId: 1 });
    [s] = reduce(s, { type: 'claimed', block: 184209, reward: '4 tYACA', chain: 'nullifier · note hash' });
    expect(s.ledger[0]).toMatchObject({
      kind: 'minted',
      text: 'claim in block 184,209 · 4 tYACA minted, privately',
    });
    expect(s.wins).toBe(1);
    [s] = reduce(s, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, { type: 'failed', error: 'claim reverted' });
    expect(s.ledger[0]).toMatchObject({ kind: 'failed', text: 'claim reverted' });
    for (let i = 0; i < 250; i++) [s] = reduce(s, attempt(1));
    expect(s.ledger).toHaveLength(200);
    expect(new Set(s.ledger.map((l) => l.id)).size).toBe(200);
  });

  test('the samples keep the last minute; the rate is over the last 20 proofs', () => {
    let [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    for (let i = 0; i < 30; i++) [s] = reduce(s, attempt(2, i * 3000));
    expect(s.samples.length).toBe(21); // t ∈ [27 s, 87 s]
    expect(s.samples[0]?.t).toBe(27_000);
    expect(s.recent).toHaveLength(20);
    expect(proofsPerMinute(s.recent)).toBe(20);
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
    expect(reduce(claiming, { type: 'claimed', block: 1, reward: '4' })[0].phase).toBe('idle');
  });

  test('failures halt and keep the message', () => {
    const [s] = reduce(initial, { type: 'start', epoch: epoch(1n) });
    const [failed, cmds] = reduce(s, { type: 'failed', error: 'worker crashed' });
    expect(failed).toMatchObject({ phase: 'idle', lastError: 'worker crashed' });
    expect(cmds).toEqual([{ type: 'halt' }]);
  });

  test('an abandoned prover is terminal: start is refused until the page reloads', () => {
    const [s] = reduce(initial, { type: 'start', epoch: epoch(1n) });
    const [dead, cmds] = reduce(s, { type: 'prover-dead', error: 'prover keeps crashing; reload the page' });
    expect(cmds).toEqual([]);
    expect(dead).toMatchObject({ phase: 'idle', job: null, proverDead: true });
    expect(reduce(dead, { type: 'start', epoch: epoch(1n) })).toEqual([dead, []]);
  });
});
