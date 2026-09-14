// Registers a deployed miner's version with the portal: from then on the portal forwards into it,
// its exits count against its cap, and its launch time anchors the cap's schedule. Everything but
// the Registry index comes from the record; the index is looked up, never typed.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Hex } from 'viem';
import { confirmed, minerBytes32, type Operator, registryIndexOf, writeOpts } from './operator.ts';

const repo = resolve(import.meta.dir, '../../../..');

export interface RegisterResult {
  version: bigint;
  index: bigint;
  txHash: Hex;
}

export async function registerVersion(op: Operator): Promise<RegisterResult> {
  const version = BigInt(op.record.rollupVersion);
  const info = await op.portal.read.versionInfo([version]);
  if (info.registered) throw new Error(`version ${version} is already registered`);
  const index = await registryIndexOf(op, version);
  if (index === undefined) throw new Error(`the Registry has no version ${version}`);
  const launchAt = BigInt(op.record.launchAt);
  const txHash = await confirmed(op, () =>
    op.portal.write.registerVersion([version, index, minerBytes32(op.record), launchAt], writeOpts(op)),
  );
  return { version, index, txHash };
}

/** Writes the version's Registry index into the record's bridge block: the pages name the version by it. */
export function noteRegistryIndex(op: Operator, index: bigint): void {
  op.record.bridge.registryIndex = index.toString();
  writeFileSync(resolve(repo, op.recordPath), `${JSON.stringify(op.record, null, 2)}\n`);
}

/** Lists (or unlists) an address that may forward held send-aheads without the holder's signature. */
export const setForwarder = (op: Operator, forwarder: Hex, listed: boolean): Promise<Hex> =>
  confirmed(op, () => op.portal.write.setForwarder([forwarder, listed], writeOpts(op)));
