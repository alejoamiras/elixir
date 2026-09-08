import { describe, expect, test } from 'bun:test';
import { createStore } from 'jotai';
import type { EpochInfo } from '../src/lib/reducer.ts';
import { startPublicEpoch } from '../src/public-epoch.ts';
import { epochAtom } from '../src/state.ts';

const info = (epoch: number, claims = 0): EpochInfo => ({
  epoch: BigInt(epoch),
  seed: 7n,
  target: 1n << 122n,
  openedAt: 1_000n,
  claims,
});

describe('the public epoch poll', () => {
  test('fills the atom, keeps the claims fresh, never regresses the epoch, stops on handover', async () => {
    const store = createStore();
    const answers = [info(38, 1), info(38, 2), info(37, 4), info(39, 0)];
    const poll = startPublicEpoch(store, async () => answers.shift() ?? info(99), { intervalMs: 60_000 });
    poll.start();
    await poll.tick(); // the read start() put out
    expect(store.get(epochAtom)).toMatchObject({ epoch: 38n, claims: 1 });
    await poll.tick();
    expect(store.get(epochAtom)).toMatchObject({ epoch: 38n, claims: 2 });
    await poll.tick(); // an older epoch than shown: dropped
    expect(store.get(epochAtom)).toMatchObject({ epoch: 38n, claims: 2 });
    poll.stop(); // the controller takes the atom
    store.set(epochAtom, info(40, 1));
    await poll.tick(); // stopped: no read, no write
    expect(answers).toHaveLength(1);
    expect(store.get(epochAtom)).toMatchObject({ epoch: 40n, claims: 1 });
  });

  test('a read that was out when the poll stopped writes nothing', async () => {
    const store = createStore();
    let release: (() => void) | undefined;
    const poll = startPublicEpoch(
      store,
      () =>
        new Promise<EpochInfo>((r) => {
          release = () => r(info(38, 3));
        }),
      { intervalMs: 60_000 },
    );
    poll.start();
    const first = poll.tick();
    poll.stop();
    store.set(epochAtom, info(41, 0));
    release?.();
    await first;
    expect(store.get(epochAtom)).toMatchObject({ epoch: 41n, claims: 0 });
  });
});
