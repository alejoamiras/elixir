import { describe, expect, test } from 'bun:test';
import { createStore } from 'jotai';
import type { Started } from '../src/boot.ts';
import { Session } from '../src/session.ts';
import { bootAtom } from '../src/state.ts';

// The attempt bookkeeping (generation, cancel, supersession) with the ceremony and the wallet-level
// work both faked: the wallet's own stop-on-abort lives in startSession and is covered by the E2E.
const fakePre = () => {
  const calls = { start: 0, stop: 0 };
  const publicEpoch = { start: () => calls.start++, stop: () => calls.stop++, tick: async () => {} };
  return { pre: { publicEpoch } as never, calls };
};

/** A Session whose preflight and startImpl are fakes; `runAttempt` is exercised through the real methods. */
function harness(startImpl: (...a: never[]) => Promise<Started>) {
  const store = createStore();
  const pre = fakePre();
  const session = new Session(store, { nodeUrl: 'x', miner: 'm', token: 't' } as never, {
    startImpl: startImpl as never,
    preflightImpl: async () => {
      store.set(bootAtom, { phase: 'signedOut', records: [] });
      return pre.pre;
    },
  });
  return { store, session, pre };
}

const started = (dispose = () => {}): Started => ({
  controller: { dispose } as never,
  wallet: () => ({}) as never,
  threads: 4,
});

// A ceremony that resolves at once with a throwaway master and record.
const ceremony = () => ({
  record: { id: 'r', account: { address: `0x${'ab'.repeat(32)}`, index: 0 } } as never,
  master: new Uint8Array(32).fill(7),
});
// runAttempt is the internal the open methods share; exercise it directly with a controllable ceremony.
const runAttempt = (s: Session, c: () => unknown, label = 'passkey') =>
  (s as unknown as { runAttempt: (l: string, c: () => unknown) => Promise<void> }).runAttempt(label, c);

describe('the opening attempt', () => {
  test('a cancel after the ceremony ends in signedOut with no error and zeros the master', async () => {
    let releaseSteps: (() => void) | undefined;
    let seenSignal: AbortSignal | undefined;
    const master = new Uint8Array(32).fill(7);
    const { store, session, pre } = harness(async (_s, _p, _c, _r, _m, opts: { signal: AbortSignal }) => {
      seenSignal = opts.signal;
      await new Promise<void>((r) => (releaseSteps = r));
      opts.signal.throwIfAborted();
      return started();
    });
    await session.ready;
    const run = runAttempt(session, () => ({ record: ceremony().record, master }));
    await new Promise((r) => setTimeout(r, 5));
    expect(store.get(bootAtom).phase).toBe('opening');
    const cancel = session.cancelOpening();
    releaseSteps?.(); // the steps settle; the signal is now aborted
    await Promise.all([run, cancel]);
    expect(seenSignal?.aborted).toBe(true);
    expect(store.get(bootAtom).phase).toBe('signedOut');
    expect((store.get(bootAtom) as { error?: string }).error).toBeUndefined();
    expect(pre.calls.start).toBe(1); // the epoch is handed back to the public poll
    expect(Array.from(master)).toEqual(Array.from(new Uint8Array(32))); // zeroed
  });

  test('a dismissal during the ceremony is inert; Cancel works once it is over', async () => {
    let finishCeremony: (() => void) | undefined;
    let releaseSteps: (() => void) | undefined;
    const { store, session } = harness(async (_s, _p, _c, _r, _m, opts: { signal: AbortSignal }) => {
      await new Promise<void>((r) => (releaseSteps = r));
      opts.signal.throwIfAborted();
      return started();
    });
    await session.ready;
    const run = runAttempt(session, async () => {
      await new Promise<void>((r) => (finishCeremony = r));
      return ceremony();
    });
    await new Promise((r) => setTimeout(r, 5));
    await session.cancelOpening(); // during the ceremony: a no-op
    expect(store.get(bootAtom).phase).toBe('opening');
    finishCeremony?.();
    await new Promise((r) => setTimeout(r, 5));
    const cancel = session.cancelOpening(); // after it: aborts
    releaseSteps?.();
    await Promise.all([run, cancel]);
    expect(store.get(bootAtom).phase).toBe('signedOut');
  });

  test('a superseded attempt publishes nothing and disposes what it made', async () => {
    let releaseFirst: (() => void) | undefined;
    let disposedFirst = false;
    let call = 0;
    const { store, session } = harness(async (_s, _p, _c, _r, _m, _o) => {
      call++;
      if (call === 1) {
        await new Promise<void>((r) => (releaseFirst = r));
        return started(() => {
          disposedFirst = true;
        });
      }
      return started();
    });
    await session.ready;
    const first = runAttempt(session, ceremony);
    await new Promise((r) => setTimeout(r, 5));
    const second = runAttempt(session, ceremony); // supersedes the first
    await second;
    expect(store.get(bootAtom).phase).toBe('ready'); // the second won
    releaseFirst?.(); // the first finally lands
    await first;
    expect(disposedFirst).toBe(true); // its controller was thrown away
    expect(store.get(bootAtom).phase).toBe('ready'); // and it published nothing over the second
  });

  test('a failure (not a cancel) shows signedOut with the error', async () => {
    const { store, session } = harness(async () => {
      throw new Error('the node did not answer the first read');
    });
    await session.ready;
    await runAttempt(session, ceremony);
    const boot = store.get(bootAtom) as { phase: string; error?: string };
    expect(boot.phase).toBe('signedOut');
    expect(boot.error).toMatch(/did not answer/);
  });
});
