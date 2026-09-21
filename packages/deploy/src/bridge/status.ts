// One version's standing on the portal as the operator prints it: the shared reader's flows, plus
// the version after next (the deadline's other arm) the page never needs.
import { type PortalReader, portalReader, type VersionFlows } from '@yacana/bridge/portal-reader';
import type { Hex } from 'viem';
import type { Operator } from './operator.ts';

export interface VersionStatus extends VersionFlows {
  afterNextAt: bigint;
}

const readerOf = (op: Operator): PortalReader =>
  portalReader(op.publicClient, {
    portal: op.record.bridge.portal as Hex,
    registry: op.record.bridge.registry as Hex,
    deployBlock: BigInt(op.record.bridge.deployBlock ?? 0),
  });

export async function versionStatus(op: Operator, version: bigint): Promise<VersionStatus> {
  const [flows, afterNextAt] = await Promise.all([
    readerOf(op).flows(version),
    op.portal.read.afterNextAt([version]),
  ]);
  return { ...flows, afterNextAt: BigInt(afterNextAt) };
}

/** Every version the portal has registered, in registration order. */
export const registeredVersions = (op: Operator): Promise<bigint[]> => readerOf(op).registered();

/** The lines for one version; `recordMiner` adds a warning when the portal registered another miner for it. */
export const statusLines = (s: VersionStatus, recordMiner?: string): string[] => [
  `version ${s.version}: ${s.registered ? `registered (index ${s.registryIndex}, launch ${s.launchAt})` : 'not registered'}`,
  ...(s.registered && recordMiner && s.miner.toLowerCase() !== recordMiner.toLowerCase()
    ? [`  miner mismatch: the portal registered ${s.miner} for this version; the record names ${recordMiner}`]
    : []),
  `  flip ${s.flipAt || '—'} · after next ${s.afterNextAt || '—'} · deadline ${s.deadline === (1n << 256n) - 1n ? 'open' : s.deadline}`,
  `  exited ${s.exited} · inbound ${s.inbound} · cap ${s.cap} · headroom ${s.headroom}`,
  `  ${s.paused ? `paused until ${s.pausedUntil}` : 'not paused'} (${s.pausedSeconds}s used) · retire ${s.retireSent ? 'sent' : 'not sent'} · deposits ${s.depositsClosed ? 'closed' : 'open'}`,
];
