// The Worker's scheduling, kept free of bb.js so it can be tested with fakes: one job at a time,
// a queued replacement, stop, and reconfigure (finish the proof in flight, rebuild, resume).
import type { FromWorker, MineJob, ToWorker } from './worker-protocol';

export interface ProverBackend {
  /** Builds the prover with `threads`; resolves once proofs can be made. */
  init(threads: number): Promise<void>;
  destroy(): Promise<void>;
  /**
   * Mines `job` until a winner or until `keepGoing()` says stop; reports every attempt with
   * the nonce it used. Resolves true on a winner (already posted), false when stopped.
   */
  mine(job: MineJob, onAttempt: (nonce: bigint) => boolean): Promise<boolean>;
}

export function createProverLoop(backend: ProverBackend, post: (m: FromWorker) => void) {
  let current: MineJob | undefined;
  let queued: MineJob | undefined;
  let stopRequested = false;
  let userStopped = false;
  let reconfigureTo: number | undefined;
  let rebuilding: Promise<void> | undefined;

  const fail = (err: unknown) =>
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });

  const rebuild = async (threads: number) => {
    rebuilding = backend.destroy().then(() => backend.init(threads));
    try {
      await rebuilding;
    } finally {
      rebuilding = undefined;
    }
  };

  async function run(job: MineJob): Promise<void> {
    if (rebuilding) await rebuilding;
    current = job;
    stopRequested = false;
    userStopped = false;
    let nextNonce = job.startNonce;
    try {
      const won = await backend.mine(job, (nonce) => {
        nextNonce = nonce + 1n;
        return !stopRequested;
      });
      if (won) return;
      if (reconfigureTo !== undefined && !queued && !userStopped) {
        // The same job continues where it stopped, with the same secret, on the new backend.
        queued = { ...job, startNonce: nextNonce };
      } else {
        post({ type: 'stopped', epoch: job.epoch, secretId: job.secretId, nextNonce });
      }
    } finally {
      current = undefined;
      const threads = reconfigureTo;
      reconfigureTo = undefined;
      if (threads !== undefined) await rebuild(threads);
      const next = queued;
      queued = undefined;
      if (next) void run(next).catch(fail);
    }
  }

  return {
    handle(m: ToWorker): void {
      switch (m.type) {
        case 'init':
          void backend.init(m.threads).catch(fail);
          return;
        case 'mine':
          if (!current) return void run(m.job).catch(fail);
          // One job at a time: the running one is asked to stop and the new one takes over.
          queued = m.job;
          stopRequested = true;
          return;
        case 'stop':
          queued = undefined;
          userStopped = true;
          stopRequested = true;
          return;
        case 'reconfigure':
          if (current) {
            reconfigureTo = m.threads;
            stopRequested = true;
          } else void rebuild(m.threads).catch(fail);
          return;
        case 'crash':
          // Test hook: an uncaught exception inside the Worker, which the page sees as `onerror`.
          throw new Error('synthetic prover crash');
      }
    },
  };
}
