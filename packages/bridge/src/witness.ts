// An exit's proof for the portal: the Outbox leaf the miner's message became, the membership
// witness the source node serves for it, and the archive line that carries both once the source
// node is gone (a forward from the archive alone is the bridge's last resort, and the site serves
// the archive at /witnesses/<profile>.jsonl).
import { sha256Trunc } from '@aztec/foundation/crypto/sha256';
import { Fr } from '@aztec/foundation/curves/bn254';
import type { EthAddress } from '@aztec/foundation/eth-address';
import type { AztecAddress } from '@aztec/stdlib/aztec-address';
import { computeL2ToL1MessageHash } from '@aztec/stdlib/hash';
import type { AztecNode } from '@aztec/stdlib/interfaces/client';
import type { L2ToL1MembershipWitness } from '@aztec/stdlib/messaging';
import { TxHash } from '@aztec/stdlib/tx';
import type { Hex } from 'viem';
import { exitContent, MAX_AMOUNT, sendAheadContent } from './content.ts';
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

/**
 * The root the Outbox derives from a leaf and its witness: the sibling path folded with the
 * rollup's truncated sha256, the leaf index's bits choosing the side. Equal to the epoch's root on
 * the Outbox iff the witness proves the leaf.
 */
export const rootOf = (leaf: Fr, path: Hex[], leafIndex: bigint): Hex => {
  let node = leaf.toBuffer();
  let index = leafIndex;
  for (const sibling of path) {
    const s = Buffer.from(sibling.slice(2), 'hex');
    node = sha256Trunc(index & 1n ? Buffer.concat([s, node]) : Buffer.concat([node, s]));
    index >>= 1n;
  }
  return `0x${node.toString('hex')}`;
};

const HEX32 = /^0x[0-9a-f]{64}$/i;
const HEX20 = /^0x[0-9a-f]{40}$/i;
const DECIMAL = /^(0|[1-9][0-9]*)$/;
/** Deeper than any epoch's out-hash tree; bounds the fold and the leaf id. */
export const MAX_PATH_LENGTH = 64;

const fieldsOf = (raw: unknown, where: string) => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
    throw new Error(`${where}: not an object`);
  const o = raw as Record<string, unknown>;
  const fail = (what: string): never => {
    throw new Error(`${where}: ${what}`);
  };
  return {
    dec: (k: string): string =>
      typeof o[k] === 'string' && DECIMAL.test(o[k]) ? o[k] : fail(`${k} is not a decimal integer`),
    hex: (k: string, re: RegExp, bytes: number): Hex =>
      typeof o[k] === 'string' && re.test(o[k])
        ? (o[k].toLowerCase() as Hex)
        : fail(`${k} is not ${bytes} bytes of hex`),
    int: (k: string): number =>
      typeof o[k] === 'number' && Number.isSafeInteger(o[k]) && o[k] >= 0
        ? o[k]
        : fail(`${k} is not a whole number`),
    list: (k: string): unknown[] => (Array.isArray(o[k]) ? o[k] : fail(`${k} is not a list`)),
    fail,
  };
};

/** An archive entry checked field by field, so a bad line names what is wrong with it. */
export function parseArchivedExit(raw: unknown, where: string): ArchivedExit {
  const f = fieldsOf(raw, where);
  const kind = f.int('kind') as ExitKind;
  if (kind !== 1 && kind !== 2) f.fail(`kind ${kind} is neither an exit nor a send-ahead`);
  const amount = f.dec('amount');
  if (BigInt(amount) > MAX_AMOUNT) f.fail('amount exceeds a u128');
  const path = f
    .list('path')
    .map((h, i) =>
      typeof h === 'string' && HEX32.test(h)
        ? (h.toLowerCase() as Hex)
        : f.fail(`path[${i}] is not 32 bytes of hex`),
    );
  if (path.length > MAX_PATH_LENGTH) f.fail(`path of ${path.length} is deeper than any epoch tree`);
  const leafIndex = f.dec('leafIndex');
  if (BigInt(leafIndex) >= 1n << BigInt(path.length))
    f.fail(`leaf index ${leafIndex} is outside a path of ${path.length}`);
  const numCheckpointsInEpoch = f.int('numCheckpointsInEpoch');
  if (numCheckpointsInEpoch === 0) f.fail('an epoch has at least one checkpoint');
  return {
    version: f.dec('version'),
    index: f.int('index'),
    kind,
    amount,
    aux: f.hex('aux', HEX32, 32),
    recipientOrRedeemKey: f.hex('recipientOrRedeemKey', HEX20, 20),
    txHash: f.hex('txHash', HEX32, 32),
    epoch: f.dec('epoch'),
    numCheckpointsInEpoch,
    leafIndex,
    path,
  };
}

/** The archive is JSON lines; a line that does not parse or does not fit is reported, not skipped. */
export const readArchive = (text: string): ArchivedExit[] =>
  text
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l, i) => {
      const where = `witness archive line ${i + 1}`;
      let json: unknown;
      try {
        json = JSON.parse(l);
      } catch (e) {
        throw new Error(`${where} is not JSON: ${e instanceof Error ? e.message : e}`);
      }
      return parseArchivedExit(json, where);
    });

export const archiveLine = (a: ArchivedExit): string => `${JSON.stringify(a)}\n`;
