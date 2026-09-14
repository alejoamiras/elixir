// One version's standing on the portal, as the operator and the stats page read it.
import type { Operator } from './operator.ts';

export interface VersionStatus {
  version: bigint;
  registered: boolean;
  miner: string;
  registryIndex: bigint;
  launchAt: bigint;
  flipAt: bigint;
  afterNextAt: bigint;
  exited: bigint;
  inbound: bigint;
  cap: bigint;
  headroom: bigint;
  /** Unix seconds after which the version's exits are refused; the max uint256 while open-ended. */
  deadline: bigint;
  paused: boolean;
  pausedUntil: bigint;
  pausedSeconds: bigint;
  retireSent: boolean;
  depositsClosed: boolean;
}

export async function versionStatus(op: Operator, version: bigint): Promise<VersionStatus> {
  const [info, flipAt, afterNextAt, cap, headroom, deadline, paused] = await Promise.all([
    op.portal.read.versionInfo([version]),
    op.portal.read.flipAt([version]),
    op.portal.read.afterNextAt([version]),
    op.portal.read.cap([version]),
    op.portal.read.headroom([version]),
    op.portal.read.deadline([version]),
    op.portal.read.isPaused([version]),
  ]);
  return {
    version,
    registered: info.registered,
    miner: info.miner,
    registryIndex: BigInt(info.registryIndex),
    launchAt: BigInt(info.launchAt),
    flipAt: BigInt(flipAt),
    afterNextAt: BigInt(afterNextAt),
    exited: info.exited,
    inbound: info.inbound,
    cap,
    headroom,
    deadline,
    paused,
    pausedUntil: BigInt(info.pausedUntil),
    pausedSeconds: BigInt(info.pausedSeconds),
    retireSent: info.retireSent,
    depositsClosed: info.depositsClosed,
  };
}

/** Every version the portal has registered, in registration order. */
export async function registeredVersions(op: Operator): Promise<bigint[]> {
  const count = await op.portal.read.registeredCount();
  const versions: bigint[] = [];
  for (let i = 0n; i < count; i++) versions.push(await op.portal.read.registeredVersions([i]));
  return versions;
}

export const statusLines = (s: VersionStatus): string[] => [
  `version ${s.version}: ${s.registered ? `registered (index ${s.registryIndex}, launch ${s.launchAt})` : 'not registered'}`,
  `  flip ${s.flipAt || '—'} · after next ${s.afterNextAt || '—'} · deadline ${s.deadline === (1n << 256n) - 1n ? 'open' : s.deadline}`,
  `  exited ${s.exited} · inbound ${s.inbound} · cap ${s.cap} · headroom ${s.headroom}`,
  `  ${s.paused ? `paused until ${s.pausedUntil}` : 'not paused'} (${s.pausedSeconds}s used) · retire ${s.retireSent ? 'sent' : 'not sent'} · deposits ${s.depositsClosed ? 'closed' : 'open'}`,
];
