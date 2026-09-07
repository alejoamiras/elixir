import { describe, expect, test } from 'vitest';
import { proofsPerMinute } from '../../../miner-core/src/metrics.ts';
import { type EpochInfo, initial, MINTED_FRESH_MS, mintedFresh, reduce, SAMPLE_SPAN_MS } from './reducer';

const epoch = (n: bigint, seed = 7n): EpochInfo => ({
  epoch: n,
  seed,
  target: 1n << 122n,
  openedAt: 0n,
  claims: 0,
});

const MINTED = {
  txHash: '0xt',
  nullifier: '0xn',
  noteHash: '0xh',
  noteHashes: 1,
  claims: [1, 2] as [number, number],
};

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
    [s] = reduce(s, { type: 'claimed', block: 184209, reward: '4 tYACA', ...MINTED });
    expect(s.ledger[0]).toMatchObject({
      kind: 'minted',
      text: '4 tYACA minted, privately',
      links: { block: 184209, tx: MINTED.txHash },
    });
    expect(s.wins).toBe(1);
    [s] = reduce(s, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, { type: 'failed', error: 'claim reverted' });
    expect(s.ledger[0]).toMatchObject({ kind: 'failed', text: 'claim reverted' });
    for (let i = 0; i < 250; i++) [s] = reduce(s, attempt(1));
    expect(s.ledger).toHaveLength(200);
    expect(new Set(s.ledger.map((l) => l.id)).size).toBe(200);
  });

  test('the samples keep the last three minutes; the rate is over the last 20 proofs', () => {
    expect(SAMPLE_SPAN_MS).toBe(180_000);
    let [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    for (let i = 0; i < 80; i++) [s] = reduce(s, attempt(2, i * 3000));
    expect(s.samples.length).toBe(61); // t ∈ [57 s, 237 s]
    expect(s.samples[0]?.t).toBe(57_000);
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
    expect(reduce(claiming, { type: 'claimed', block: 1, reward: '4', ...MINTED })[0].phase).toBe('idle');
  });

  test('the claim walks proving → sent (with the expiry) → waiting → minted; the mint survives the restart and the next proof, fades after ten seconds, and a new claim replaces it', () => {
    let [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, { type: 'winner', epoch: 3n, secretId: 1, at: 1000 });
    expect(s.claim).toEqual({ step: 'proving', since: 1000, done: [] });
    [s] = reduce(s, { type: 'sent', txHash: '0xab', expiresAt: 600, at: 41_000 });
    expect(s.claim).toEqual({ step: 'sent', since: 41_000, done: [40_000], txHash: '0xab', expiresAt: 600 });
    [s] = reduce(s, { type: 'included', block: 9, at: 50_000 });
    expect(s.claim).toMatchObject({ step: 'waiting', done: [40_000, 9000] });
    [s] = reduce(s, { type: 'claimed', block: 9, reward: '4 tYACA', ...MINTED, at: 51_000 });
    expect(s).toMatchObject({ phase: 'idle', claim: null, minted: { ...MINTED, at: 51_000 }, wins: 1 });
    expect(s.ledger[0]).toMatchObject({ kind: 'minted', links: { block: 9, tx: '0xt' } });
    // The controller restarts mining at once and the next proof lands seconds later: neither clears the mint.
    [s] = reduce(s, { type: 'start', epoch: epoch(3n) });
    expect(s.minted).toMatchObject({ ...MINTED, block: 9 });
    [s] = reduce(s, attempt(2));
    expect(s.minted).toMatchObject({ ...MINTED, block: 9 });
    // Freshness is the display's business, from the mint's own clock.
    expect(mintedFresh(s.minted, 51_000 + 5_000)).toBe(true);
    expect(mintedFresh(s.minted, 51_000 + MINTED_FRESH_MS)).toBe(false);
    expect(mintedFresh(null, 0)).toBe(false);
    // A stop keeps the record but the display is stale by then; a new claim replaces it.
    [s] = reduce(s, { type: 'stop' });
    expect(s.minted).toMatchObject({ block: 9 });
    [s] = reduce(s, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, { type: 'winner', epoch: 3n, secretId: s.secretId, at: 70_000 });
    expect(s.phase).toBe('claiming');
    expect(s.minted).toBeNull();
  });

  test('an expired claim goes idle with its card, which survives the restart that follows', () => {
    let [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, { type: 'winner', epoch: 3n, secretId: 1 });
    const [next, cmds] = reduce(s, {
      type: 'failed',
      error: 'Invalid expiration timestamp',
      kind: 'expired',
    });
    expect(next).toMatchObject({ phase: 'idle', job: null, claim: null, notice: { kind: 'expired' } });
    expect(cmds).toEqual([]);
    expect(next.ledger[0]).toMatchObject({ kind: 'failed', text: 'Invalid expiration timestamp' });
    // The controller restarts on the epoch open now (a newer one here), under a fresh secret.
    const [again, restart] = reduce(next, { type: 'start', epoch: epoch(4n, 9n) });
    expect(again).toMatchObject({ phase: 'mining', secretId: 2, notice: { kind: 'expired' } });
    expect(restart).toEqual([{ type: 'mine', epoch: 4n, seed: 9n, target: 1n << 122n, secretId: 2 }]);
    expect(reduce(again, { type: 'winner', epoch: 4n, secretId: 2 })[0].notice).toBeNull();
  });

  test('a reverted or blocked claim enters recovering; recovered returns to idle, paused waits', () => {
    let [s] = reduce(initial, { type: 'start', epoch: epoch(3n) });
    [s] = reduce(s, { type: 'winner', epoch: 3n, secretId: 1 });
    for (const kind of ['reverted', 'delivery-blocked'] as const) {
      const [r, cmds] = reduce(s, { type: 'failed', error: 'reverted', kind });
      expect(r).toMatchObject({ phase: 'recovering', job: null, notice: { kind: 'reverted' } });
      expect(cmds).toEqual([]);
      expect(reduce(r, { type: 'start', epoch: epoch(3n) })[1]).toEqual([]);
    }
    const [r] = reduce(s, { type: 'failed', error: 'reverted', kind: 'reverted' });
    const [ok] = reduce(r, { type: 'recovered' });
    expect(ok).toMatchObject({ phase: 'idle', notice: null });
    expect(ok.ledger[0]).toMatchObject({ kind: 'epoch', text: 'chain view rebuilt · notes recovered' });
    const [paused] = reduce(r, { type: 'paused', until: 100 + 25 * 60_000, at: 100 });
    expect(paused.phase).toBe('idle');
    expect(paused.notice).toMatchObject({ kind: 'paused', until: 100 + 25 * 60_000 });
    expect(paused.notice?.body).toContain('about 25 min');
  });

  test('offline shows a card that online clears, without touching any other notice', () => {
    const [off] = reduce(initial, { type: 'offline', since: 0 });
    expect(off.notice?.kind).toBe('offline');
    expect(reduce(off, { type: 'online' })[0].notice).toBeNull();
    const [dead] = reduce(initial, { type: 'prover-dead', error: 'gone' });
    expect(reduce(dead, { type: 'online' })[0].notice?.kind).toBe('prover-dead');
  });

  test('other failures halt and keep the message', () => {
    const [s] = reduce(initial, { type: 'start', epoch: epoch(1n) });
    const [failed, cmds] = reduce(s, { type: 'failed', error: 'worker crashed' });
    expect(failed).toMatchObject({ phase: 'idle', notice: { kind: 'failed', body: 'worker crashed' } });
    expect(cmds).toEqual([{ type: 'halt' }]);
    expect(reduce(failed, { type: 'start', epoch: epoch(1n) })[0].notice).toBeNull();
  });

  test('an abandoned prover is terminal: start is refused until the page reloads', () => {
    const [s] = reduce(initial, { type: 'start', epoch: epoch(1n) });
    const [dead, cmds] = reduce(s, { type: 'prover-dead', error: 'prover keeps crashing; reload the page' });
    expect(cmds).toEqual([]);
    expect(dead).toMatchObject({ phase: 'idle', job: null, proverDead: true });
    expect(reduce(dead, { type: 'start', epoch: epoch(1n) })).toEqual([dead, []]);
  });
});
