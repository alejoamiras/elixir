import type { AztecAddress } from '@aztec/aztec.js/addresses';
import type { Contract, ContractFunctionInteraction } from '@aztec/aztec.js/contracts';
import type { Fr } from '@aztec/foundation/curves/bn254';
import { Gas } from '@aztec/stdlib/gas';

/**
 * Gas limits a claim must declare: the network's per-tx maximum. A claim's public cost depends on
 * state it cannot see when sent — the Nth claim of an epoch also retargets and opens the next one —
 * so limits estimated from a simulation against a non-closing epoch under-declare, and the tx
 * reverts (fee paid, ticket unspent) whenever it lands as the closer. A successful tx pays for the
 * gas it uses, not for what it declares.
 */
export async function claimGasLimits(node: {
  getNodeInfo(): Promise<{ txsLimits: { gas: { daGas: number; l2Gas: number } } }>;
}): Promise<Gas> {
  const { txsLimits } = await node.getNodeInfo();
  return new Gas(txsLimits.gas.daGas, txsLimits.gas.l2Gas);
}

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
