import { describe, expect, test } from 'vitest';
import type { DemoJob, DemoOut } from '../../../web-miner/src/demo/index.ts';
import { type DemoState, demoThreads, runDemo, type WorkerLike } from './machine';

const job: DemoJob = {
  chainId: 1n,
  rollupVersion: 1n,
  miner: '0x01',
  version: 1n,
  seed: '0x02',
  epoch: 3n,
  target: 1n << 120n,
  threads: 2,
};

/** A Worker that emits what the test scripts, and remembers whether it was terminated. */
function fakeWorker() {
  const w: WorkerLike & { posted: unknown[]; terminated: number; emit: (m: DemoOut) => void } = {
    posted: [],
    terminated: 0,
    onmessage: null,
    onerror: null,
    postMessage: (m) => w.posted.push(m),
    terminate: () => {
      w.terminated++;
    },
    emit: (m) => w.onmessage?.({ data: m } as MessageEvent<DemoOut>),
  };
  return w;
}

describe('the demo run', () => {
  test('steps accumulate, the result ends it, the Worker is terminated once', async () => {
    const w = fakeWorker();
    const seen: DemoState[] = [];
    const run = runDemo(job, { worker: () => w }, (s) => seen.push(s));
    expect(w.posted).toEqual([{ type: 'prove-once', job }]);
    w.emit({ type: 'step', name: 'crs', ms: 1200 });
    w.emit({ type: 'step', name: 'prover', ms: 800 });
    w.emit({ type: 'step', name: 'proof', ms: 3100 });
    w.emit({ type: 'step', name: 'score', ms: 20 });
    w.emit({ type: 'result', score: 2.3, proveMs: 3100 });
    const final = await run;
    expect(final).toMatchObject({ phase: 'done', score: 2.3, proveMs: 3100 });
    expect((final as { steps: unknown[] }).steps).toHaveLength(4);
    expect(seen.map((s) => s.phase)).toEqual(['proving', 'proving', 'proving', 'proving', 'proving', 'done']);
    expect(w.terminated).toBe(1);
    // Anything after the end is ignored: the Worker is gone.
    w.emit({ type: 'error', message: 'late' });
    expect(seen.at(-1)?.phase).toBe('done');
  });

  test('a Worker error, a timeout and a Worker that fails to load each end in error, terminated', async () => {
    const w = fakeWorker();
    const errored = runDemo(job, { worker: () => w }, () => {});
    w.emit({ type: 'step', name: 'crs', ms: 5 });
    w.emit({ type: 'error', message: 'crs: g1 does not match its pin' });
    expect(await errored).toMatchObject({
      phase: 'error',
      message: expect.stringContaining('pin'),
      timedOut: false,
      steps: [{ name: 'crs', ms: 5 }],
    });
    expect(w.terminated).toBe(1);

    // Both runners see this file; a real (short) timeout keeps it free of fake-timer APIs.
    const slow = fakeWorker();
    const timed = runDemo(job, { worker: () => slow, timeoutMs: 20 }, () => {});
    expect(await timed).toMatchObject({ phase: 'error', timedOut: true });
    expect(slow.terminated).toBe(1);

    const failed = await runDemo(
      job,
      {
        worker: () => {
          throw new Error('no Worker here');
        },
      },
      () => {},
    );
    expect(failed).toMatchObject({ phase: 'error', message: 'no Worker here' });
  });

  test('threads: one core to the page, at most four, never below one', () => {
    expect(demoThreads(1)).toBe(1);
    expect(demoThreads(2)).toBe(1);
    expect(demoThreads(4)).toBe(3);
    expect(demoThreads(16)).toBe(4);
    expect(demoThreads(Number.NaN)).toBe(1);
  });
});
