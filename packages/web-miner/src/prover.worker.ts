/// <reference lib="webworker" />
import './shims/node-globals';
import './pinned-crs';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { score } from '../../miner-core/src/metrics.ts';
import { mineEpoch } from '../../miner-core/src/miner.ts';
import { isWinner } from '../../miner-core/src/proof.ts';
import { BbJsWorkProver } from '../../miner-core/src/work.ts';
import { purgeCrsCache } from './pinned-crs';
import { createProverLoop, type ProverBackend } from './prover-loop';
import type { FromWorker, MineJob, ToWorker } from './worker-protocol';

const post = (m: FromWorker) => self.postMessage(m);

let prover: BbJsWorkProver | undefined;

const backend: ProverBackend = {
  async init(threads) {
    const t0 = performance.now();
    // bb.js prefers its IndexedDB copy of the CRS over any download: only bytes that went through
    // the pinned path may be there, so the cache is dropped before the backend is created.
    await purgeCrsCache();
    const artifact = await (await fetch('/artifacts/yacana_work.json')).json();
    const api = await Barretenberg.new({ threads, backend: BackendType.WasmWorker });
    prover = new BbJsWorkProver(artifact, api);
    post({ type: 'ready', threads, initMs: performance.now() - t0 });
  },
  async destroy() {
    await prover?.destroy();
    prover = undefined;
  },
  async mine(job: MineJob, keepGoing) {
    if (!prover) throw new Error('prover not initialised');
    const winner = await mineEpoch(
      prover,
      {
        domain: Fr.fromString(job.domain),
        seed: Fr.fromString(job.seed),
        epoch: job.epoch,
        secret: Fr.fromString(job.secret),
        recipient: Fr.fromString(job.recipient),
        target: job.target,
        startNonce: job.startNonce,
      },
      {
        onAttempt: (nonce, digest, proveMs) => {
          post({
            type: 'attempt',
            epoch: job.epoch,
            secretId: job.secretId,
            nonce,
            proveMs,
            score: score(digest),
            win: isWinner(digest, job.target),
          });
          return keepGoing(nonce);
        },
      },
    );
    if (!winner) return false;
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
    return true;
  },
};

const loop = createProverLoop(backend, post);
self.onmessage = (e: MessageEvent<ToWorker>) => loop.handle(e.data);
