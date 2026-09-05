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

const errorMessage = (err: unknown): FromWorker => ({
  type: 'error',
  message: err instanceof Error ? err.message : String(err),
});

const stoppedMessage = (job: MineJob, nextNonce: bigint): FromWorker => ({
  type: 'stopped',
  epoch: job.epoch,
  secretId: job.secretId,
  nextNonce,
});

export function createProverLoop(backend: ProverBackend, post: (m: FromWorker) => void) {
  /** The job that owns the loop: waiting for a rebuild, mining, or rebuilding after it stopped. */
  let current: MineJob | undefined;
  let mining = false;
  let queued: MineJob | undefined;
  let stopRequested = false;
  let userStopped = false;
  /** A reconfigure that arrived while proving: applied once the proof in flight is done. */
  let reconfigureTo: number | undefined;
  let pendingThreads: number | undefined;
  let rebuilding: Promise<void> | undefined;

  const fail = (err: unknown) => post(errorMessage(err));

  /** Rebuilds run one at a time; requests during one coalesce into a last rebuild at the latest count. */
  const rebuild = (threads: number): Promise<void> => {
    pendingThreads = threads;
    rebuilding ??= (async () => {
      try {
        while (pendingThreads !== undefined) {
          const t = pendingThreads;
          pendingThreads = undefined;
          await backend.destroy();
          await backend.init(t);
        }
      } finally {
        rebuilding = undefined;
      }
    })();
    return rebuilding;
  };

  const stopped = (job: MineJob, nextNonce: bigint) => post(stoppedMessage(job, nextNonce));

  /** After a rebuild wait: whether the job still owns the loop, or a stop / replacement won. */
  const stillOwner = (job: MineJob): boolean => {
    if (!userStopped && !queued) return true;
    current = undefined;
    const next = queued;
    queued = undefined;
    if (next && !userStopped) void run(next).catch(fail);
    else stopped(job, job.startNonce);
    return false;
  };

  /** Once the job stopped, rebuild if asked (still the owner meanwhile), then hand over. */
  const settle = async (resume: MineJob | undefined): Promise<void> => {
    mining = false;
    const threads = reconfigureTo;
    reconfigureTo = undefined;
    if (threads !== undefined) await rebuild(threads);
    current = undefined;
    const next = queued ?? resume;
    if (resume && (userStopped || queued)) stopped(resume, resume.startNonce);
    queued = undefined;
    if (next && !userStopped) void run(next).catch(fail);
  };

  async function run(job: MineJob): Promise<void> {
    current = job;
    if (rebuilding) await rebuilding;
    if (!stillOwner(job)) return;
    stopRequested = false;
    mining = true;
    let nextNonce = job.startNonce;
    let resume: MineJob | undefined;
    try {
      const won = await backend.mine(job, (nonce) => {
        nextNonce = nonce + 1n;
        return !stopRequested;
      });
      if (won) return;
      // The same job continues where it stopped, with the same secret, on the new backend.
      if (reconfigureTo !== undefined && !queued && !userStopped) resume = { ...job, startNonce: nextNonce };
      else stopped(job, nextNonce);
    } finally {
      await settle(resume);
    }
  }

  return {
    handle(m: ToWorker): void {
      switch (m.type) {
        case 'init':
          void backend.init(m.threads).catch(fail);
          return;
        case 'mine':
          userStopped = false;
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
          if (mining) {
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
