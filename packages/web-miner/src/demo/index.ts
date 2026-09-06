// The landing's "Prove one now": one proof of W against the open epoch, scored and discarded, in
// the miner's Worker pipeline (pinned CRS, bb.js). Only types and the Worker factory live here so
// a page that imports it ships none of the prover until the Worker is created.

export interface DemoJob {
  chainId: bigint;
  rollupVersion: bigint;
  /** The miner contract's address (hex); the Worker derives the deploy domain from it. */
  miner: string;
  version: bigint;
  /** The open epoch's seed (hex) and number, and the target the score is measured against. */
  seed: string;
  epoch: bigint;
  target: bigint;
  /** bb.js threads, at least 1. */
  threads: number;
}

export type DemoIn = { type: 'prove-once'; job: DemoJob };

export type DemoStepName = 'crs' | 'prover' | 'proof' | 'score';

export type DemoOut =
  | { type: 'step'; name: DemoStepName; ms: number }
  | { type: 'result'; score: number; proveMs: number }
  | { type: 'error'; message: string };

/** Creates the Worker; its chunk (bb.js and the WASM included) is fetched on this call, not before. */
export const createDemoWorker = (): Worker =>
  new Worker(new URL('./demo.worker.ts', import.meta.url), { type: 'module' });
