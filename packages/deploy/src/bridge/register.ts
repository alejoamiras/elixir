// Registers a deployed miner's version with the portal: from then on the portal forwards into it,
// its exits count against its cap, and its launch time anchors the cap's schedule. Everything but
// the Registry index comes from the record; the index is looked up, never typed.
import type { Hex } from 'viem';
import { confirmed, minerBytes32, type Operator, registryIndexOf, writeOpts } from './operator.ts';

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
