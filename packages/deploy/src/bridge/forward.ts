// Forwarding a version's exits: every `ExitRecorded` the miner logged, its Outbox witness from the
// source node once the exit's epoch settled, archived to deployments/witnesses/<profile>.jsonl so
// a forward outlives the node, then consumed on the portal in batches under the forwarder key. A
// send-ahead is refused when the version it would land on registered a miner other than the one
// the announced record names.
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { loadContractArtifact } from '@aztec/aztec.js/abi';
import { createAztecNodeClient } from '@aztec/aztec.js/node';
import { EthAddress } from '@aztec/foundation/eth-address';
import { OutboxAbi } from '@aztec/l1-artifacts/OutboxAbi';
import { RollupAbi } from '@aztec/l1-artifacts/RollupAbi';
import { AztecAddress } from '@aztec/stdlib/aztec-address';
import { exitRecordedEvent, readExits } from '@yacana/bridge/src/exits.ts';
import { type ForwardArgs, yacanaPortalAbi } from '@yacana/bridge/src/portal.ts';
import {
  type ArchivedExit,
  archiveEntry,
  archiveLine,
  exitMessageContent,
  fetchWitness,
  forwardArgsFromArchive,
  outboxLeaf,
  type RecordedExit,
  readArchive,
} from '@yacana/bridge/src/witness.ts';
import { getContract, type Hex, parseEventLogs } from 'viem';
import { MINER_ARTIFACT_PATH } from '../../../miner-core/src/artifacts.ts';
import type { Deployment } from '../deploy.ts';
import { confirmed, minerBytes32, type Operator, writeOpts } from './operator.ts';

const repo = resolve(import.meta.dir, '../../../..');

export interface ForwardOptions {
  /** The version whose exits are forwarded: its record, and a node that still serves it. */
  source: Deployment;
  sourceNodeUrl?: string;
  /** The announced deployment a send-ahead may land on; a registered miner that differs refuses every K2. */
  target?: Deployment;
  /** Relative to the repo root; defaults to deployments/witnesses/<profile>.jsonl. */
  archive?: string;
  /** The source node is gone: forward what the archive holds, read nothing. */
  fromArchive?: boolean;
  batch?: number;
}

export interface ForwardReport {
  archived: number;
  /** Exits whose epoch has not settled on the source yet: no witness, nothing archived. */
  pending: number[];
  /** A send-ahead's `inboxIndex` names the message its claim consumes on the target; an exit's is 0. */
  forwarded: { index: number; leafId: bigint; inboxIndex: bigint }[];
  failed: { position: number; reason: Hex }[];
  refusedKind2: boolean;
}

export const archivePath = (profile: string, archive?: string): string =>
  resolve(repo, archive ?? `deployments/witnesses/${profile}.jsonl`);

/** Reads what the source node logged and archives every settled exit not archived yet. */
export async function archiveExits(
  opts: ForwardOptions,
): Promise<{ entries: ArchivedExit[]; pending: number[] }> {
  const path = archivePath(opts.source.profile, opts.archive);
  const known = existsSync(path) ? readArchive(readFileSync(path, 'utf8')) : [];
  const version = BigInt(opts.source.rollupVersion);
  const mine = known.filter((e) => e.version === version.toString());
  if (opts.fromArchive) return { entries: mine, pending: [] };
  const node = createAztecNodeClient(opts.sourceNodeUrl ?? opts.source.nodeUrl);
  const miner = AztecAddress.fromStringUnsafe(opts.source.miner);
  const event = await exitRecordedEvent(loadContractArtifact(await Bun.file(MINER_ARTIFACT_PATH).json()));
  const scope = {
    chainId: BigInt(opts.source.chainId),
    rollupVersion: version,
    miner,
    portal: EthAddress.fromString(opts.source.portal as string),
  };
  const pending: number[] = [];
  let page = await readExits(node, miner, event);
  for (;;) {
    for (const exit of page.exits) {
      if (mine.some((e) => e.index === exit.index)) continue;
      const entry = await witnessOf(node, scope, exit, version);
      if (!entry) {
        pending.push(exit.index);
        continue;
      }
      mkdirSync(dirname(path), { recursive: true });
      appendFileSync(path, archiveLine(entry));
      mine.push(entry);
    }
    if (!page.nextCursor) break;
    page = await readExits(node, miner, event, { afterEvent: page.nextCursor });
  }
  return { entries: mine, pending };
}

const witnessOf = async (
  node: ReturnType<typeof createAztecNodeClient>,
  scope: Parameters<typeof outboxLeaf>[0],
  exit: RecordedExit,
  version: bigint,
): Promise<ArchivedExit | undefined> => {
  const leaf = outboxLeaf(scope, exitMessageContent(exit, EthAddress.fromString(exit.recipientOrRedeemKey)));
  const witness = await fetchWitness(node, exit.txHash, leaf);
  return witness ? archiveEntry(version, exit, witness) : undefined;
};

/** Whether the live version's registered miner is the announced one; `true` when nothing is registered yet. */
async function targetMinerMatches(op: Operator, target: Deployment | undefined): Promise<boolean> {
  if (!target) return true;
  const count = await op.registry.read.numberOfVersions();
  const canonical = await op.registry.read.getVersion([count - 1n]);
  const info = await op.portal.read.versionInfo([canonical]);
  return !info.registered || info.miner.toLowerCase() === minerBytes32(target).toLowerCase();
}

/** The entries the source version's Outbox has not seen consumed: leaf ids repeat across epochs, so both count. */
async function unconsumed(op: Operator, version: bigint, entries: ArchivedExit[]): Promise<ArchivedExit[]> {
  const rollup = await op.registry.read.getRollup([version]);
  const outboxAddress = await getContract({
    address: rollup,
    abi: RollupAbi,
    client: op.publicClient,
  }).read.getOutbox();
  const outbox = getContract({ address: outboxAddress, abi: OutboxAbi, client: op.publicClient });
  const out: ArchivedExit[] = [];
  for (const e of entries) {
    if (!(await outbox.read.hasMessageBeenConsumedAtEpoch([BigInt(e.epoch), leafIdOf(e)]))) out.push(e);
  }
  return out;
}

/** Archives, then forwards every unconsumed exit of the source version in batches. */
export async function forwardAll(op: Operator, opts: ForwardOptions): Promise<ForwardReport> {
  const version = BigInt(opts.source.rollupVersion);
  const { entries, pending } = await archiveExits(opts);
  const kind2Allowed = await targetMinerMatches(op, opts.target);
  const due = (await unconsumed(op, version, entries)).filter((e) => kind2Allowed || e.kind !== 2);
  const report: ForwardReport = {
    archived: entries.length,
    pending,
    forwarded: [],
    failed: [],
    refusedKind2: !kind2Allowed,
  };
  const size = opts.batch ?? 10;
  // A gas estimate cannot see through `forwardMany`'s try/catch: the cheapest "successful" run is
  // the one where every leaf runs out of its stipend and is logged as failed. The limit is stated.
  const leafGas = await op.portal.read.LEAF_GAS();
  for (let i = 0; i < due.length; i += size) {
    const slice = due.slice(i, i + size);
    const args: ForwardArgs[] = slice.map((e) => forwardArgsFromArchive(e));
    const gas = leafGas * BigInt(slice.length) + 200_000n;
    const txHash = await confirmed(op, () =>
      op.portal.write.forwardMany([version, args], { ...writeOpts(op), gas }),
    );
    const receipt = await op.publicClient.getTransactionReceipt({ hash: txHash });
    for (const log of parseEventLogs({ abi: yacanaPortalAbi, logs: receipt.logs })) {
      if (log.eventName === 'Forwarded') {
        const entry = slice.find(
          (e) => BigInt(e.epoch) === log.args.epoch && leafIdOf(e) === log.args.leafId,
        );
        if (entry)
          report.forwarded.push({
            index: entry.index,
            leafId: log.args.leafId,
            inboxIndex: log.args.inboxIndex,
          });
      } else if (log.eventName === 'LeafFailed') {
        report.failed.push({ position: Number(log.args.position), reason: log.args.reason });
      }
    }
  }
  return report;
}

const leafIdOf = (e: ArchivedExit): bigint => (1n << BigInt(e.path.length)) + BigInt(e.leafIndex);
