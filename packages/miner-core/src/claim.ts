// Builds the private `claim` interaction for a wallet to prove and send.
import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Contract, ContractFunctionInteraction } from '@aztec/aztec.js/contracts';
import type { Fr } from '@aztec/foundation/curves/bn254';

export interface ClaimInput {
  epoch: bigint;
  nonce: bigint;
  out: Fr;
  secret: Fr;
  /** The 410 proof fields, exactly as hashed into the ticket. */
  proofFields: Fr[];
  recipient: AztecAddress;
}

export const buildClaim = (miner: Contract, c: ClaimInput): ContractFunctionInteraction =>
  miner.methods.claim(c.epoch, c.nonce, c.out, c.secret, c.proofFields, c.recipient);
