// Messages between the page and the prover Worker. Field elements cross as hex strings.
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

export type ToWorker =
  | { type: 'init'; threads: number }
  | { type: 'mine'; job: MineJob }
  | { type: 'stop' }
  | { type: 'crash' };

export type FromWorker =
  | { type: 'ready'; threads: number; initMs: number }
  | { type: 'attempt'; epoch: bigint; secretId: number; nonce: bigint; proveMs: number }
  | {
      type: 'winner';
      epoch: bigint;
      secretId: number;
      nonce: bigint;
      out: string;
      proofFields: string[];
      digest: string;
      attempts: number;
    }
  | { type: 'stopped'; epoch: bigint; secretId: number; nextNonce: bigint }
  | { type: 'error'; message: string };
