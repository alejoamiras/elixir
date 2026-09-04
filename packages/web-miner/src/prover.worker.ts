/// <reference lib="webworker" />
import './pinned-crs';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { mineEpoch } from '../../miner-core/src/miner.ts';
import { BbJsWorkProver } from '../../miner-core/src/work.ts';
import type { FromWorker, MineJob, ToWorker } from './worker-protocol';

const post = (m: FromWorker) => self.postMessage(m);

let prover: BbJsWorkProver | undefined;
let stopRequested = false;
let busy = false;

async function init(threads: number) {
  const t0 = performance.now();
  const artifact = await (await fetch('/artifacts/elixir_work.json')).json();
  const api = await Barretenberg.new({ threads, backend: BackendType.WasmWorker });
  prover = new BbJsWorkProver(artifact, api);
  post({ type: 'ready', threads, initMs: performance.now() - t0 });
}

async function mine(job: MineJob) {
  if (!prover) throw new Error('prover not initialised');
  if (busy) throw new Error('already mining');
  busy = true;
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
    busy = false;
  }
}

self.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data;
  const run = m.type === 'init' ? init(m.threads) : m.type === 'mine' ? mine(m.job) : undefined;
  if (m.type === 'stop') stopRequested = true;
  run?.catch((err: unknown) =>
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) }),
  );
};
