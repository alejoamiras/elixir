import { describe, expect, test } from 'vitest';
import { createProverLoop, type ProverBackend } from './prover-loop';
import type { FromWorker, MineJob } from './worker-protocol';

const job = (startNonce = 1n): MineJob => ({
  epoch: 3n,
  seed: '0x1',
  domain: '0x2',
  secret: '0x3',
  recipient: '0x4',
  target: 1n << 120n,
  secretId: 1,
  startNonce,
});

/** A backend whose proofs are ticks: every `prove` resolves on the next microtask. */
function fakeBackend(winAtNonce?: bigint) {
  const calls: string[] = [];
  const mined: { startNonce: bigint; secret: string }[] = [];
  let release: (() => void) | undefined;
  const backend: ProverBackend = {
    async init({ threads, presto }) {
      calls.push(`init ${threads}${presto ? ` @${presto.port}` : ''}`);
    },
    async destroy() {
      calls.push('destroy');
    },
    async mine(j, keepGoing) {
      mined.push({ startNonce: j.startNonce, secret: j.secret });
      for (let nonce = j.startNonce; ; nonce++) {
        await new Promise<void>((r) => {
          release = r;
        });
        if (nonce === winAtNonce) return true;
        if (!keepGoing(nonce)) return false;
      }
    },
  };
  return { backend, calls, mined, prove: () => release?.() };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe('prover loop', () => {
  test('reconfigure finishes the proof in flight, rebuilds, and resumes the same job at the next nonce', async () => {
    const posted: FromWorker[] = [];
    const f = fakeBackend();
    const loop = createProverLoop(f.backend, (m) => posted.push(m));
    loop.handle({ type: 'init', threads: 11, presto: null });
    loop.handle({ type: 'mine', job: job() });
    await tick();
    f.prove(); // nonce 1 done
    await tick();
    f.prove(); // nonce 2 done
    await tick();
    loop.handle({ type: 'reconfigure', threads: 3, presto: null });
    f.prove(); // nonce 3: the proof in flight finishes, then the job stops
    await tick();
    await tick();
    expect(f.calls).toEqual(['init 11', 'destroy', 'init 3']);
    expect(f.mined).toEqual([
      { startNonce: 1n, secret: '0x3' },
      { startNonce: 4n, secret: '0x3' },
    ]);
    expect(posted.filter((m) => m.type === 'stopped')).toEqual([]);
  });

  test('a stop during a reconfigure rebuilds but does not resume; a new job replaces the old one', async () => {
    const posted: FromWorker[] = [];
    const f = fakeBackend();
    const loop = createProverLoop(f.backend, (m) => posted.push(m));
    loop.handle({ type: 'init', threads: 4, presto: null });
    loop.handle({ type: 'mine', job: job() });
    await tick();
    loop.handle({ type: 'reconfigure', threads: 2, presto: null });
    loop.handle({ type: 'stop' });
    f.prove();
    await tick();
    await tick();
    expect(f.calls).toEqual(['init 4', 'destroy', 'init 2']);
    expect(f.mined).toHaveLength(1);
    expect(posted).toContainEqual({ type: 'stopped', epoch: 3n, secretId: 1, nextNonce: 2n });
    loop.handle({ type: 'mine', job: { ...job(7n), secretId: 2 } });
    await tick();
    expect(f.mined[1]).toEqual({ startNonce: 7n, secret: '0x3' });
  });

  test('a reconfigure while idle rebuilds at once and a job arriving meanwhile waits for it', async () => {
    const f = fakeBackend();
    const loop = createProverLoop(f.backend, () => {});
    loop.handle({ type: 'init', threads: 4, presto: null });
    loop.handle({ type: 'reconfigure', threads: 6, presto: null });
    loop.handle({ type: 'mine', job: job() });
    await tick();
    expect(f.calls).toEqual(['init 4', 'destroy', 'init 6']);
    expect(f.mined).toEqual([{ startNonce: 1n, secret: '0x3' }]);
  });
});

describe('prover loop, rebuilds under contention', () => {
  test('reconfigures during a rebuild coalesce into one more, at the latest whole config', async () => {
    const f = fakeBackend();
    const loop = createProverLoop(f.backend, () => {});
    const presto = { host: '127.0.0.1', port: 59833, httpsPort: 59834, httpsOnly: true };
    loop.handle({ type: 'init', threads: 4, presto: null });
    loop.handle({ type: 'reconfigure', threads: 6, presto });
    loop.handle({ type: 'reconfigure', threads: 2, presto: null });
    loop.handle({ type: 'reconfigure', threads: 8, presto });
    await tick();
    expect(f.calls).toEqual(['init 4', 'destroy', 'init 6 @59833', 'destroy', 'init 8 @59833']);
  });

  test('the same threads with the endpoint added is a rebuild: a native retry never needs a second init', async () => {
    const f = fakeBackend();
    const loop = createProverLoop(f.backend, () => {});
    const presto = { host: '127.0.0.1', port: 59833, httpsPort: 59834, httpsOnly: true };
    loop.handle({ type: 'init', threads: 4, presto: null });
    loop.handle({ type: 'reconfigure', threads: 4, presto });
    await tick();
    expect(f.calls).toEqual(['init 4', 'destroy', 'init 4 @59833']);
  });

  test('a stop while a job waits for a rebuild wins: nothing mines, the stop is reported', async () => {
    const f = fakeBackend();
    const posted: FromWorker[] = [];
    const loop = createProverLoop(f.backend, (m) => posted.push(m));
    loop.handle({ type: 'init', threads: 4, presto: null });
    loop.handle({ type: 'reconfigure', threads: 6, presto: null });
    loop.handle({ type: 'mine', job: job(5n) });
    loop.handle({ type: 'stop' });
    await tick();
    expect(f.mined).toEqual([]);
    expect(posted).toEqual([{ type: 'stopped', epoch: 3n, secretId: 1, nextNonce: 5n }]);
    // A later job starts normally: the stop does not outlive it.
    loop.handle({ type: 'mine', job: job(9n) });
    await tick();
    expect(f.mined).toEqual([{ startNonce: 9n, secret: '0x3' }]);
  });

  test('two jobs arriving during a rebuild: only the last one mines', async () => {
    const f = fakeBackend();
    const loop = createProverLoop(f.backend, () => {});
    loop.handle({ type: 'init', threads: 4, presto: null });
    loop.handle({ type: 'reconfigure', threads: 6, presto: null });
    loop.handle({ type: 'mine', job: { ...job(), secretId: 1 } });
    loop.handle({ type: 'mine', job: { ...job(), secretId: 2 } });
    await tick();
    expect(f.mined).toHaveLength(1);
  });
});
