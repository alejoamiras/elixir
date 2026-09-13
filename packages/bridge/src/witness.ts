// An exit's proof for the portal: the Outbox leaf the miner's message became, the membership
// witness the source node serves for it, and the archive line that carries both once the source
// node is gone (a forward from the archive alone is the bridge's last resort, and the site serves
// the archive at /witnesses/<profile>.jsonl).
import { Fr } from '@aztec/foundation/curves/bn254';
import type { EthAddress } from '@aztec/foundation/eth-address';
import type { AztecAddress } from '@aztec/stdlib/aztec-address';
import { computeL2ToL1MessageHash } from '@aztec/stdlib/hash';
import type { AztecNode } from '@aztec/stdlib/interfaces/client';
import type { L2ToL1MembershipWitness } from '@aztec/stdlib/messaging';
import { TxHash } from '@aztec/stdlib/tx';
import type { Hex } from 'viem';
import { exitContent, sendAheadContent } from './content.ts';
import type { ExitKind, ExitLeaf, ForwardArgs } from './portal.ts';

/** Where an exit lives: which miner on which version sent it to which portal on which chain. */
export interface ExitScope {
  chainId: bigint;
  rollupVersion: bigint;
  miner: AztecAddress;
  portal: EthAddress;
}

/** The exit as the miner's `ExitRecorded` log describes it, plus the transaction that made it. */
export interface RecordedExit extends ExitLeaf {
  index: number;
  txHash: string;
}

/** The message content the miner sent, from the recorded exit's own fields. */
export const exitMessageContent = (exit: ExitLeaf, recipientOrKey: EthAddress): Fr =>
  exit.kind === 1
    ? exitContent(recipientOrKey, exit.amount, Fr.fromHexString(exit.aux))
    : sendAheadContent(exit.amount, Fr.fromHexString(exit.aux), recipientOrKey);

/** The Outbox leaf: sha256-to-field over sender (miner, version), recipient (portal, chain) and content. */
export const outboxLeaf = (scope: ExitScope, content: Fr): Fr =>
  computeL2ToL1MessageHash({
    l2Sender: scope.miner,
    l1Recipient: scope.portal,
    content,
    rollupVersion: new Fr(scope.rollupVersion),
    chainId: new Fr(scope.chainId),
  });

/** The witness the source node serves; `undefined` until the exit's epoch has settled. */
export const fetchWitness = (
  node: Pick<AztecNode, 'getL2ToL1MembershipWitness'>,
  txHash: string,
  leaf: Fr,
): Promise<L2ToL1MembershipWitness | undefined> =>
  node.getL2ToL1MembershipWitness(TxHash.fromString(txHash), leaf);

/** One archived exit: everything the portal's `forward` needs, and nothing the operator infers. */
export interface ArchivedExit {
  version: string;
  index: number;
  kind: ExitKind;
  amount: string;
  aux: Hex;
  recipientOrRedeemKey: Hex;
  txHash: string;
  epoch: string;
  numCheckpointsInEpoch: number;
  leafIndex: string;
  path: Hex[];
}

export const archiveEntry = (
  version: bigint,
  exit: RecordedExit,
  witness: L2ToL1MembershipWitness,
): ArchivedExit => ({
  version: version.toString(),
  index: exit.index,
  kind: exit.kind,
  amount: exit.amount.toString(),
  aux: exit.aux,
  recipientOrRedeemKey: exit.recipientOrRedeemKey,
  txHash: exit.txHash,
  epoch: witness.epochNumber.toString(),
  numCheckpointsInEpoch: witness.numCheckpointsInEpoch,
  leafIndex: witness.leafIndex.toString(),
  path: witness.siblingPath.toBufferArray().map((b) => `0x${b.toString('hex')}` as Hex),
});

/** The forward arguments from an archive line, with no node in sight. */
export const forwardArgsFromArchive = (
  a: ArchivedExit,
  signed?: { sig: Hex; expiry: bigint },
): ForwardArgs => ({
  kind: a.kind,
  amount: BigInt(a.amount),
  aux: a.aux,
  recipientOrRedeemKey: a.recipientOrRedeemKey,
  epoch: BigInt(a.epoch),
  numCheckpointsInEpoch: BigInt(a.numCheckpointsInEpoch),
  leafIndex: BigInt(a.leafIndex),
  path: a.path,
  sig: signed?.sig ?? '0x',
  expiry: signed?.expiry ?? 0n,
});

/** The archive is JSON lines; a line that does not parse is reported, not skipped. */
export const readArchive = (text: string): ArchivedExit[] =>
  text
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l, i) => {
      try {
        return JSON.parse(l) as ArchivedExit;
      } catch (e) {
        throw new Error(`witness archive line ${i + 1} is not JSON: ${e instanceof Error ? e.message : e}`);
      }
    });

export const archiveLine = (a: ArchivedExit): string => `${JSON.stringify(a)}\n`;
