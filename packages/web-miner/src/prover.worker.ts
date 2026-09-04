/// <reference lib="webworker" />
import './pinned-crs';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { mineEpoch } from '../../miner-core/src/miner.ts';
import { BbJsWorkProver } from '../../miner-core/src/work.ts';
import { purgeCrsCache } from './pinned-crs';
import type { FromWorker, MineJob, ToWorker } from './worker-protocol';

const post = (m: FromWorker) => self.postMessage(m);

let prover: BbJsWorkProver | undefined;
let stopRequested = false;
let current: MineJob | undefined;
/** A job received while another runs; it starts as soon as the running one has stopped. */
let queued: MineJob | undefined;

async function init(threads: number) {
  const t0 = performance.now();
  // bb.js prefers its IndexedDB copy of the CRS over any download: only bytes that went through
  // the pinned path may be there, so the cache is dropped before the backend is created.
  await purgeCrsCache();
  const artifact = await (await fetch('/artifacts/elixir_work.json')).json();
  const api = await Barretenberg.new({ threads, backend: BackendType.WasmWorker });
  prover = new BbJsWorkProver(artifact, api);
  post({ type: 'ready', threads, initMs: performance.now() - t0 });
}

async function run(job: MineJob) {
  if (!prover) throw new Error('prover not initialised');
  current = job;
  stopRequested = false;
  let nextNonce = job.startNonce;
  try {
    const winner = await mineEpoch(
      prover,
      {
        domain: Fr.fromString(job.domain),
        seed: Fr.fromString(job.seed),
        epoch: job.epoch,
        secret: Fr.fromString(job.secret),
        target: job.target,
        startNonce: job.startNonce,
      },
      {
        onAttempt: (nonce, _digest, proveMs) => {
          nextNonce = nonce + 1n;
          post({ type: 'attempt', epoch: job.epoch, secretId: job.secretId, nonce, proveMs });
          return !stopRequested;
        },
      },
    );
    if (winner) {
      post({
        type: 'winner',
        epoch: job.epoch,
        secretId: job.secretId,
        nonce: winner.nonce,
        out: winner.out.toString(),
        proofFields: winner.proofFields.map((f) => f.toString()),
        digest: winner.digest.toString(),
        attempts: winner.attempts,
      });
    } else {
      post({ type: 'stopped', epoch: job.epoch, secretId: job.secretId, nextNonce });
    }
  } finally {
    current = undefined;
    const next = queued;
    queued = undefined;
    if (next) void run(next).catch(fail);
  }
}

const fail = (err: unknown) =>
  post({ type: 'error', message: err instanceof Error ? err.message : String(err) });

function mine(job: MineJob) {
  if (!current) return void run(job).catch(fail);
  // One job at a time: the running one is asked to stop and the new one takes over.
  queued = job;
  stopRequested = true;
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  switch (m.type) {
    case 'init':
      void init(m.threads).catch(fail);
      return;
    case 'mine':
      mine(m.job);
      return;
    case 'stop':
      queued = undefined;
      stopRequested = true;
      return;
    case 'crash':
      // Test hook: an uncaught exception inside the Worker, which the page sees as `onerror`.
      throw new Error('synthetic prover crash');
  }
};
