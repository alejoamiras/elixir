// One accepted claim, as its transaction's public effect records it: the leaf writes to this
// deployment's `claims[e]` and `last_digest[e]` and the siloed ticket nullifier of that digest. Public
// storage keeps counts and a digest per epoch, never a nullifier or a note hash, so the landing's
// ledger example can only come from an effect, recorded once and committed.
import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { computePublicDataTreeLeafSlot, deriveStorageSlotInMap } from '@aztec/stdlib/hash';
import { ticketNullifier } from '../../miner-core/src/proof.ts';
import { fixedSlot, type StorageLayout } from '../../miner-core/src/reader.ts';

export interface ExampleClaim {
  miner: string;
  chainId: string;
  rollupVersion: string;
  epoch: number;
  /** The counter before and after: a claim increments by one. */
  claims: [number, number];
  block: number;
  txHash: string;
  nullifier: string;
  noteHash: string;
}

/** A transaction effect with its fields as hex strings: what the node returns, made serialisable. */
export interface EffectView {
  l2BlockNumber: number;
  nullifiers: string[];
  noteHashes: string[];
  publicDataWrites: { leafSlot: string; value: string }[];
}

export interface Identity {
  miner: string;
  chainId: string;
  rollupVersion: string;
}

type RawEffect = {
  l2BlockNumber: number;
  data: {
    nullifiers: { toString(): string }[];
    noteHashes: { toString(): string }[];
    publicDataWrites: { leafSlot: { toString(): string }; value: { toString(): string } }[];
  };
};

export const effectView = (effect: unknown): EffectView => {
  const e = effect as RawEffect;
  return {
    l2BlockNumber: e.l2BlockNumber,
    nullifiers: e.data.nullifiers.map((n) => n.toString()),
    noteHashes: e.data.noteHashes.map((n) => n.toString()),
    publicDataWrites: e.data.publicDataWrites.map((w) => ({
      leafSlot: w.leafSlot.toString(),
      value: w.value.toString(),
    })),
  };
};

/**
 * The claim in `effect` for `identity.miner`, searching epochs `0..epochs`; throws when the effect
 * lacks the two leaf writes, or its nullifiers lack the digest's siloed ticket (the search is by
 * value, never by position).
 */
export async function exampleClaimFromEffect(
  effect: EffectView,
  identity: Identity,
  layout: StorageLayout,
  txHash: string,
  epochs: number,
): Promise<ExampleClaim> {
  const miner = AztecAddress.fromStringUnsafe(identity.miner);
  const writes = new Map(effect.publicDataWrites.map((w) => [w.leafSlot, w.value]));
  const nullifiers = new Set(effect.nullifiers);
  const leaf = async (name: string, e: number) =>
    (
      await computePublicDataTreeLeafSlot(
        miner,
        await deriveStorageSlotInMap(fixedSlot(layout, name), { toField: () => new Fr(e) }),
      )
    ).toString();
  for (let e = 0; e <= epochs; e++) {
    const claims = writes.get(await leaf('claims', e));
    const digest = writes.get(await leaf('last_digest', e));
    if (claims === undefined || digest === undefined) continue;
    const nullifier = (await ticketNullifier(Fr.fromString(digest), miner)).toString();
    if (!nullifiers.has(nullifier))
      throw new Error(`the effect writes claims[${e}] but carries no ticket nullifier for its digest`);
    const noteHash = effect.noteHashes[0];
    if (!noteHash) throw new Error('the effect carries no note hash');
    const after = Number(BigInt(claims));
    return {
      ...identity,
      epoch: e,
      claims: [after - 1, after],
      block: effect.l2BlockNumber,
      txHash,
      nullifier,
      noteHash,
    };
  }
  throw new Error(`no claims[e] and last_digest[e] writes for ${identity.miner} in epochs 0..${epochs}`);
}
