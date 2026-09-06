/// <reference lib="webworker" />
import '../shims/node-globals';
import '../pinned-crs';
import { BackendType, Barretenberg } from '@aztec/bb.js';
import { Fr } from '@aztec/foundation/curves/bn254';
import { score } from '../../../miner-core/src/metrics.ts';
import {
  computeDigest,
  deployDomain,
  proofToFields,
  secretCommitment,
} from '../../../miner-core/src/proof.ts';
import { BbJsWorkProver } from '../../../miner-core/src/work.ts';
import { preloadPinnedCrs, purgeCrsCache } from '../pinned-crs';
import type { DemoIn, DemoOut, DemoStepName } from './index';

const post = (m: DemoOut) => self.postMessage(m);

/** Runs `fn` and reports its wall time as one step of the panel. */
async function step<T>(name: DemoStepName, fn: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  const out = await fn();
  post({ type: 'step', name, ms: performance.now() - t0 });
  return out;
}

self.onmessage = async (e: MessageEvent<DemoIn>) => {
  const { job } = e.data;
  let api: Barretenberg | undefined;
  try {
    await step('crs', async () => {
      await purgeCrsCache();
      await preloadPinnedCrs();
    });
    const prover = await step('prover', async () => {
      const artifact = await (await fetch('/artifacts/yacana_work.json')).json();
      api = await Barretenberg.new({ threads: job.threads, backend: BackendType.WasmWorker });
      return new BbJsWorkProver(artifact, api);
    });
    const domain = await deployDomain(job.chainId, job.rollupVersion, Fr.fromString(job.miner), job.version);
    // A throwaway secret and recipient: the proof is scored here and never claimed.
    const minerCommit = await secretCommitment(Fr.random(), Fr.random());
    const t0 = performance.now();
    const { proof } = await step('proof', () =>
      prover.prove({ domain, seed: Fr.fromString(job.seed), epoch: job.epoch, minerCommit, nonce: 1n }),
    );
    const proveMs = performance.now() - t0;
    const digest = await step('score', () => computeDigest(proofToFields(proof)));
    post({ type: 'result', score: score(digest), proveMs });
  } catch (err) {
    post({ type: 'error', message: err instanceof Error ? err.message : String(err) });
  } finally {
    await api?.destroy().catch(() => {});
  }
};
