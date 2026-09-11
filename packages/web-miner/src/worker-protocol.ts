// Messages between the page and the prover Worker. Field elements cross as hex strings.
import type { PrestoPhase } from '@alejoamiras/presto-core';
import type { FallbackCause, PrestoEndpoint, ProverKind } from './presto';

export interface MineJob {
  epoch: bigint;
  seed: string;
  domain: string;
  secret: string;
  recipient: string;
  target: bigint;
  secretId: number;
  startNonce: bigint;
}

/** What a prover is built with: bb.js's threads, and Presto's endpoint when native is worth asking for. */
export interface ProverConfig {
  threads: number;
  presto: PrestoEndpoint | null;
}

export type ToWorker =
  | ({ type: 'init' } & ProverConfig)
  | { type: 'mine'; job: MineJob }
  | { type: 'stop' }
  /** Finish the proof in flight, rebuild the prover with this config, resume the job at its next nonce. */
  | ({ type: 'reconfigure' } & ProverConfig)
  | { type: 'crash' };

export type FromWorker =
  /** `prover` is the backend built, not yet proof of native proving: `prover` messages say what proved. */
  | { type: 'ready'; threads: number; initMs: number; prover: ProverKind }
  /** What actually proved the last proof changed; `sticky` means WASM until the next rebuild. */
  | { type: 'prover'; kind: ProverKind; sticky: boolean; reason?: FallbackCause }
  | { type: 'presto-phase'; phase: PrestoPhase }
  | {
      type: 'attempt';
      epoch: bigint;
      secretId: number;
      nonce: bigint;
      proveMs: number;
      score: number;
      win: boolean;
      /** The target that judged this proof: an attempt can land after its job was replaced. */
      target: bigint;
    }
  | {
      type: 'winner';
      epoch: bigint;
      secretId: number;
      nonce: bigint;
      out: string;
      proofFields: string[];
      digest: string;
      attempts: number;
      /** Who made the winning proof; a native one was verified in WASM before this message. */
      prover: ProverKind;
    }
  | { type: 'stopped'; epoch: bigint; secretId: number; nextNonce: bigint }
  | { type: 'error'; message: string };
