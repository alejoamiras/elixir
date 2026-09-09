import { describe, expect, test } from 'vitest';
import type { EpochRow } from '../../miner-core/src/reader.ts';
import { type BeatReads, type BeatSinks, bootBeats, olderBeat, pollBeats, settled } from './beats';
import { WINDOW } from './chain';
import type { Fixed, History } from './state';

/** Epoch `e` opened at `e × 300` with 4 claims (the open one 1), target 2^122. */
const row = (e: number, open: number): EpochRow => ({
  epoch: e,
  target: 1n << 122n,
  openedAt: e * 300,
  claims: e === open ? 1 : 4,
  duration: e === open ? null : 300,
  retarget: e === open ? null : 1,
  closedBy: e === open ? null : 'claims',
});
const fixedOf = (open: number): Fixed => ({
  open,
  block: { number: 99, timestamp: open * 300 + 10 },
  supply: 4n * 10n ** 18n * BigInt(open * 4),
  genesis: { target: 1n << 122n, seed: 7n, launchAt: 0 },
  readAt: 0,
});

/** A fake node: `fixed()` answers the current open epoch; `rows()` the range; the log says what was asked. */
function fake(open: () => number, opts: { failRows?: boolean } = {}) {
  const asked: [number, number][] = [];
  const published: string[] = [];
  const state: { fixed?: Fixed; history?: History } = {};
  const reads: BeatReads = {
    fixed: async () => fixedOf(open()),
    rows: async (from, to) => {
      asked.push([from, to]);
      if (opts.failRows) throw new Error('chunk 0: 503');
      return Array.from({ length: to - from + 1 }, (_, i) => row(from + i, open()));
    },
    lottery: async () => ({ mix: 5n, reveals: 2 }),
  };
  const publish: BeatSinks = {
    fixed: (f) => {
      published.push('fixed');
      state.fixed = f;
    },
    history: (h) => {
      published.push(h.error ? 'history:error' : 'history');
      state.history = h;
    },
  };
  return { reads, publish, asked, published, state };
}

const epochs = (h: History | undefined) => [...(h?.rows.keys() ?? [])].sort((a, b) => a - b);

describe('the two beats', () => {
  test('boot publishes the fixed slots first, then the newest window with the lottery', async () => {
    const f = fake(() => 60);
    await bootBeats(f.reads, f.publish);
    expect(f.published).toEqual(['fixed', 'history']);
    expect(f.asked).toEqual([[60 - WINDOW + 1, 60]]);
    expect(epochs(f.state.history)).toEqual(Array.from({ length: WINDOW }, (_, i) => 13 + i));
    expect(f.state.history?.lottery).toEqual({ mix: 5n, reveals: 2 });
    expect(f.state.history?.rows.get(60)?.duration).toBeNull();
  });

  test('a history read that fails still publishes beat one, and says so with no rows', async () => {
    const f = fake(() => 10, { failRows: true });
    await bootBeats(f.reads, f.publish);
    expect(f.published).toEqual(['fixed', 'history:error']);
    expect(f.state.fixed?.open).toBe(10);
    expect(f.state.history?.rows.size).toBe(0);
    expect(f.state.history?.error).toMatch(/503/);
  });

  test('the poll joins a close to the tail; more closes than a window drop the held rows for the newest', async () => {
    let open = 10;
    const f = fake(() => open);
    await bootBeats(f.reads, f.publish);
    open = 11;
    await pollBeats(f.reads, f.publish, { fixed: f.state.fixed as Fixed, history: f.state.history ?? null });
    expect(f.asked.at(-1)).toEqual([9, 11]);
    expect(epochs(f.state.history)).toEqual(Array.from({ length: 12 }, (_, i) => i));
    open = 11 + WINDOW + 5;
    await pollBeats(f.reads, f.publish, { fixed: f.state.fixed as Fixed, history: f.state.history ?? null });
    expect(epochs(f.state.history)[0]).toBe(open - WINDOW + 1); // no gap: the newest window alone
  });

  test('a poll whose history read fails keeps the rows held and still publishes the fixed slots', async () => {
    const f = fake(() => 10);
    await bootBeats(f.reads, f.publish);
    const failing = fake(() => 11, { failRows: true });
    await pollBeats(failing.reads, f.publish, {
      fixed: f.state.fixed as Fixed,
      history: f.state.history ?? null,
    });
    expect(f.published.slice(-2)).toEqual(['fixed', 'history:error']);
    expect(f.state.fixed?.open).toBe(11);
    expect(epochs(f.state.history)).toEqual(Array.from({ length: 11 }, (_, i) => i));
  });

  test('older joins the previous window in front; at epoch 0 there is nothing to ask', async () => {
    const f = fake(() => 100);
    await bootBeats(f.reads, f.publish);
    await olderBeat(f.reads, f.publish, {
      fixed: f.state.fixed as Fixed,
      history: f.state.history as History,
    });
    expect(f.asked.at(-1)).toEqual([53 - WINDOW, 52]);
    expect(epochs(f.state.history)[0]).toBe(5);
    const small = fake(() => 3);
    await bootBeats(small.reads, small.publish);
    const asked = small.asked.length;
    await olderBeat(small.reads, small.publish, {
      fixed: small.state.fixed as Fixed,
      history: small.state.history as History,
    });
    expect(small.asked.length).toBe(asked);
  });

  test('settled waits for beat two and for every number to be at rest', () => {
    const history: History = { rows: new Map(), lottery: null };
    expect(settled(null, new Set())).toBe(false);
    expect(settled(history, new Set(['minted']))).toBe(false);
    expect(settled(history, new Set())).toBe(true);
  });
});
