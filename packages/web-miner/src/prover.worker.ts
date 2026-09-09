/// <reference lib="webworker" />
import './shims/node-globals';
import '../../site/src/browser/node-guard.ts';
import './pinned-crs';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { score } from '../../miner-core/src/metrics.ts';
import { mineEpoch, type Winner } from '../../miner-core/src/miner.ts';
import { isWinner, secretCommitment } from '../../miner-core/src/proof.ts';
import {
  BbJsWorkProver,
  type WorkArtifact,
  type WorkInputs,
  type WorkProver,
} from '../../miner-core/src/work.ts';
import { setAcceleratorEndpoints } from '../../site/src/browser/node-guard.ts';
import { purgeCrsCache } from './pinned-crs';
import { acceleratorUrls } from './presto';
import { PrestoWorkProver } from './presto-prover';
import { createProverLoop, type ProverBackend } from './prover-loop';
import type { FromWorker, MineJob, ProverConfig, ToWorker } from './worker-protocol';

/** A native proof may wait behind Presto's queue and, once, behind its bb download. */
const ACCELERATOR_DEADLINE_MS = 600_000;

const post = (m: FromWorker) => self.postMessage(m);

let prover: WorkProver | undefined;

type Attempt = Extract<FromWorker, { type: 'attempt' }>;

async function build({ threads, presto }: ProverConfig): Promise<WorkProver> {
  // bb.js prefers its IndexedDB copy of the CRS over any download: only bytes that went through
  // the pinned path may be there, so the cache is dropped before the backend is created.
  await purgeCrsCache();
  const artifact = (await (await fetch('/artifacts/yacana_work.json')).json()) as WorkArtifact;
  const api = () => Barretenberg.new({ threads, backend: BackendType.WasmWorker });
  if (!presto) {
    setAcceleratorEndpoints(null, 0);
    return new BbJsWorkProver(artifact, await api());
  }
  // This realm's guard learns Presto's URLs before the SDK's first probe; WASM is built only on demand.
  setAcceleratorEndpoints(acceleratorUrls(presto), ACCELERATOR_DEADLINE_MS);
  return new PrestoWorkProver(artifact, api, presto, {
    prover: (kind, t) => post({ type: 'prover', kind, sticky: t.sticky, reason: t.reason }),
    phase: (phase) => {
      if (phase === 'downloading') post({ type: 'presto-phase', phase });
    },
  });
}

const winnerMessage = (job: MineJob, w: Winner, native: boolean): FromWorker => ({
  type: 'winner',
  epoch: job.epoch,
  secretId: job.secretId,
  nonce: w.nonce,
  out: w.out.toString(),
  proofFields: w.proofFields.map((f) => f.toString()),
  digest: w.digest.toString(),
  attempts: w.attempts,
  prover: native ? 'presto' : 'wasm',
});

/**
 * Mines from `startNonce`. A native winning proof is verified against the job's own public inputs
 * before its `attempt` (the ★ line) and the `winner` go out; one that fails flips the prover to WASM
 * and the same nonce is proved again. Returns true on a reported winner, false when stopped.
 */
async function mineFrom(
  p: WorkProver,
  job: MineJob,
  startNonce: bigint,
  keepGoing: (nonce: bigint) => boolean,
): Promise<boolean> {
  const native = p instanceof PrestoWorkProver ? p : null;
  const inputs: Omit<WorkInputs, 'nonce'> = {
    domain: Fr.fromString(job.domain),
    seed: Fr.fromString(job.seed),
    epoch: job.epoch,
    minerCommit: await secretCommitment(Fr.fromString(job.secret), Fr.fromString(job.recipient)),
  };
  let held: Attempt | null = null;
  const winner = await mineEpoch(
    p,
    {
      ...inputs,
      secret: Fr.fromString(job.secret),
      recipient: Fr.fromString(job.recipient),
      target: job.target,
      startNonce,
    },
    {
      onAttempt: (nonce, digest, proveMs) => {
        const win = isWinner(digest, job.target);
        const attempt: Attempt = {
          type: 'attempt',
          epoch: job.epoch,
          secretId: job.secretId,
          nonce,
          proveMs,
          score: score(digest),
          win,
        };
        // A native win is announced only once it has verified; everything else goes out at once.
        if (win && native?.active === 'presto') held = attempt;
        else post(attempt);
        return keepGoing(nonce);
      },
    },
  );
  if (!winner) return false;
  const pending = held as Attempt | null;
  if (native && pending) {
    const ok = await native.verifyWin(
      { ...inputs, nonce: winner.nonce },
      { proof: winner.proof, out: winner.out },
    );
    // A Stop or a replacement that landed during the verification wins; the nonce does not advance twice.
    if (!keepGoing(winner.nonce)) return false;
    if (!ok) {
      post({ ...pending, win: false });
      native.forceLocal('invalid-proof');
      return mineFrom(p, job, winner.nonce, keepGoing);
    }
    post(pending);
  }
  post(winnerMessage(job, winner, pending !== null));
  return true;
}

const backend: ProverBackend = {
  async init(config) {
    const t0 = performance.now();
    prover = await build(config);
    post({
      type: 'ready',
      threads: config.threads,
      initMs: performance.now() - t0,
      prover: prover instanceof PrestoWorkProver ? 'presto' : 'wasm',
    });
  },
  async destroy() {
    await prover?.destroy();
    prover = undefined;
  },
  mine(job: MineJob, keepGoing) {
    if (!prover) throw new Error('prover not initialised');
    return mineFrom(prover, job, job.startNonce, keepGoing);
  },
};

const loop = createProverLoop(backend, post);
self.onmessage = (e: MessageEvent<ToWorker>) => loop.handle(e.data);
