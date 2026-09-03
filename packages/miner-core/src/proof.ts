import { poseidon2Hash } from '@aztec/foundation/crypto/poseidon';
import { Fr } from '@aztec/foundation/curves/bn254';

/** A non-ZK UltraHonk proof for the Noir recursive verifier: 410 fields, 32-byte big-endian each. */
export const PROOF_FIELDS = 410;

// Domain separators: ASCII tags, big-endian. Must equal the Noir globals in elixir_work_lib.
export const DOM_DEPLOY = 0x454c582f6465706cn;
export const DOM_SECRET = 0x454c582f73656372n;
export const DOM_WORK = 0x454c582f776f726bn;
export const DOM_TICKET = 0x454c582f7469636bn;
export const DOM_NULL = 0x454c582f6e756c6cn;
export const DOM_SEED = 0x454c582f73656564n;

/** Split bb's binary proof into its field elements. Throws on any length but 410 × 32 bytes. */
export function proofToFields(proof: Uint8Array): Fr[] {
  if (proof.length !== PROOF_FIELDS * 32) {
    throw new Error(`proof is ${proof.length} bytes, expected ${PROOF_FIELDS * 32}`);
  }
  const fields: Fr[] = [];
  for (let i = 0; i < PROOF_FIELDS; i++)
    fields.push(Fr.fromBuffer(Buffer.from(proof.subarray(i * 32, i * 32 + 32))));
  return fields;
}

/** The ticket: Poseidon2(DOM_TICKET ∥ proof[0..410]), as the contract computes it. */
export async function computeDigest(fields: Fr[]): Promise<Fr> {
  if (fields.length !== PROOF_FIELDS)
    throw new Error(`expected ${PROOF_FIELDS} fields, got ${fields.length}`);
  return poseidon2Hash([new Fr(DOM_TICKET), ...fields]);
}

export const low128 = (digest: Fr): bigint => digest.toBigInt() & ((1n << 128n) - 1n);

export const isWinner = (digest: Fr, target: bigint): boolean => low128(digest) < target;

/** Poseidon2(DOM_SECRET, secret): the miner's commitment carried in the work circuit. */
export const secretCommitment = (secret: Fr): Promise<Fr> => poseidon2Hash([new Fr(DOM_SECRET), secret]);

/** Poseidon2(DOM_DEPLOY, chain_id, miner_contract, version): binds a proof to one deployment. */
export const deployDomain = (chainId: bigint, minerContract: Fr, version: bigint): Promise<Fr> =>
  poseidon2Hash([new Fr(DOM_DEPLOY), new Fr(chainId), minerContract, new Fr(version)]);
