// The mining loop for one epoch: prove W per nonce, hash the proof into the ticket, stop at the
// first winner (or when asked to). Chain reads and claim submission live outside it.
import type { Fr } from '@aztec/foundation/curves/bn254';
import { computeDigest, isWinner, proofToFields, secretCommitment } from './proof.ts';
import type { WorkProver } from './work.ts';

export interface MiningJob {
  domain: Fr;
  seed: Fr;
  epoch: bigint;
  secret: Fr;
  target: bigint;
  /** First nonce to try; a miner resuming mid-epoch continues where it stopped. */
  startNonce?: bigint;
}

export interface Winner {
  nonce: bigint;
  out: Fr;
  proof: Uint8Array;
  proofFields: Fr[];
  digest: Fr;
  attempts: number;
}

export interface MineOptions {
  /** Called after every proof; return false to stop without a winner (epoch switched, user paused). */
  onAttempt?: (nonce: bigint, digest: Fr, proveMs: number) => boolean | undefined;
}

export async function mineEpoch(
  prover: WorkProver,
  job: MiningJob,
  opts: MineOptions = {},
): Promise<Winner | null> {
  const minerCommit = await secretCommitment(job.secret);
  let attempts = 0;
  for (let nonce = job.startNonce ?? 1n; ; nonce++) {
    const t0 = performance.now();
    const { proof, out } = await prover.prove({
      domain: job.domain,
      seed: job.seed,
      epoch: job.epoch,
      minerCommit,
      nonce,
    });
    const proofFields = proofToFields(proof);
    const digest = await computeDigest(proofFields);
    attempts++;
    if (isWinner(digest, job.target)) return { nonce, out, proof, proofFields, digest, attempts };
    if (opts.onAttempt?.(nonce, digest, performance.now() - t0) === false) return null;
  }
}
