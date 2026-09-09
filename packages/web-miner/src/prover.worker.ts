/// <reference lib="webworker" />
import './shims/node-globals';
import '../../site/src/browser/node-guard.ts';
import './pinned-crs';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { BbJsWorkProver, type WorkArtifact, type WorkProver } from '../../miner-core/src/work.ts';
import { setAcceleratorEndpoints } from '../../site/src/browser/node-guard.ts';
import { purgeCrsCache } from './pinned-crs';
import { acceleratorUrls, downloadPhases } from './presto';
import { PrestoWorkProver } from './presto-prover';
import { createProverLoop, type ProverBackend } from './prover-loop';
import { mineFrom } from './worker-mine';
import type { FromWorker, MineJob, ProverConfig, ToWorker } from './worker-protocol';

/** A native proof may wait behind Presto's queue and, once, behind its bb download. */
const ACCELERATOR_DEADLINE_MS = 600_000;

const post = (m: FromWorker) => self.postMessage(m);

let prover: WorkProver | undefined;

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
    phase: downloadPhases((phase) => post({ type: 'presto-phase', phase })),
  });
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
    return mineFrom(prover, job, job.startNonce, keepGoing, post);
  },
};

const loop = createProverLoop(backend, post);
self.onmessage = (e: MessageEvent<ToWorker>) => loop.handle(e.data);
