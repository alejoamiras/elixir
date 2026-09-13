// The bridge page's one read and its sentences, pure over an injected reader.

import type { PortalPolicy, PortalReader, VersionFlows } from '../../bridge/src/portal-reader.ts';
import type { MigrationRecord } from '../../bridge/src/record.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { amount, duration } from '../../site/src/browser/format.ts';

export interface Step {
  id: string;
  label: string;
  state: 'pending' | 'active' | 'done' | 'failed';
  detail?: string;
}

export interface BridgeSnapshot {
  versions: VersionFlows[];
  canonical: { version: bigint; index: bigint };
  policy: PortalPolicy;
  operators: string;
  forwarders: string[];
  /** Ethereum's clock at the read (unix seconds): what a pause, a launch or a deadline is measured against. */
  chainTime: bigint;
  /** Wall clock (ms) of the read. */
  readAt: number;
}

type BridgeReads = Pick<
  PortalReader,
  'registered' | 'flows' | 'canonical' | 'policy' | 'operators' | 'forwarders' | 'blockTime'
>;

export async function readBridge(reader: BridgeReads, now = Date.now()): Promise<BridgeSnapshot> {
  const [registered, canonical, policy, operators, forwarders, chainTime] = await Promise.all([
    reader.registered(),
    reader.canonical(),
    reader.policy(),
    reader.operators(),
    reader.forwarders(),
    reader.blockTime(),
  ]);
  const versions = await Promise.all(registered.map((v) => reader.flows(v)));
  return { versions, canonical, policy, operators, forwarders, chainTime, readAt: now };
}

/**
 * The chain's clock carried forward by the wall clock since the read, for a countdown only: whether
 * exits are closed, a launch is ahead or a pause is on is decided on `chainTime` as observed, so a
 * device clock that jumps cannot declare a version closed while Ethereum is still before the deadline.
 */
export const chainNow = (s: BridgeSnapshot, now: number): number =>
  Number(s.chainTime) + Math.max(0, Math.floor((now - s.readAt) / 1000));

const yaca = (raw: bigint): string => `${amount(raw, PARAMS.DECIMALS, 2)} ${PARAMS.TOKEN_SYMBOL}`;
const day = (unix: bigint): string => new Date(Number(unix) * 1000).toISOString().slice(0, 10);
/** The portal's "never" for a deadline: the max uint256. */
const OPEN_ENDED = (1n << 256n) - 1n;

const closed = (v: VersionFlows, nowSeconds: number): boolean =>
  v.deadline !== OPEN_ENDED && BigInt(nowSeconds) > v.deadline;

/**
 * The turnstile in one sentence: what may leave now and what the rest waits for. Headroom is
 * room under the limit, not leave to go: a pause holds it and the deadline ends it, so the line
 * says which; before the flip the limit grows, after it what is beyond the frozen limit never leaves.
 */
export function exitLimitLine(v: VersionFlows, policy: PortalPolicy, nowSeconds: number): string {
  const left = `${yaca(v.exited)} has left`;
  if (closed(v, nowSeconds))
    return `exits closed on ${day(v.deadline)} · ${left}; nothing more leaves V${v.version}.`;
  const may = `${yaca(v.headroom)} may leave V${v.version}`;
  if (v.paused) return `${may} once the pause ends · ${left}.`;
  if (v.flipAt > 0n)
    return `${may} right now · the limit stopped growing at the flip; ${left}. What is beyond it cannot leave this version.`;
  const grows = `grows ${yaca(policy.perHour)} an hour`;
  if (v.launchAt > BigInt(nowSeconds))
    return `${may} right now · the limit ${grows} from the launch on ${day(v.launchAt)}; exits beyond it wait for it.`;
  return `${may} right now · ${grows}; exits beyond it wait for it to grow, until the flip freezes it.`;
}

/** The pause in one sentence: the portal's word on whether it is on, and what the operators may do with it. */
export function pauseLine(v: VersionFlows, policy: PortalPolicy, nowSeconds: number): string {
  const limits = `the operators may pause exits and deposits for up to ${duration(Number(policy.pauseMax))} a call, ${duration(Number(policy.pauseBudget))} in total per version`;
  if (!v.paused) return `not paused · ${limits}`;
  const more = Number(v.pausedUntil) - nowSeconds;
  return `paused${more > 0 ? ` for ${duration(more)} more` : ''} · ${duration(Number(v.pausedSeconds))} of the budget spent · ${limits}`;
}

export function versionLine(v: VersionFlows, canonical: { version: bigint; index: bigint }): string {
  if (!v.registered) return 'not registered on the portal yet';
  if (v.version === canonical.version)
    return v.depositsClosed
      ? 'the live version · deposits closed before the flip'
      : 'the live version · deposits and exits here';
  if (v.flipAt > 0n)
    return v.deadline === OPEN_ENDED
      ? `flipped away from on ${day(v.flipAt)} · exits stay open`
      : `flipped away from on ${day(v.flipAt)} · exits close on ${day(v.deadline)}`;
  if (v.registryIndex < canonical.index) return 'flipped away from · the flip not yet recorded on the portal';
  return 'registered ahead of the flip · not live yet';
}

/**
 * A version's phases as a timeline: the announcement (from the build's record, when it carries
 * one), the flip, the retire message, the day its exits close.
 */
export function phasesOf(v: VersionFlows, migration: MigrationRecord | null, nowSeconds: number): Step[] {
  const flipped = v.flipAt > 0n;
  return [
    announcedStep(migration, flipped),
    flipStep(v, flipped),
    retireStep(v, flipped),
    closesStep(v, nowSeconds),
  ];
}

const announcedStep = (migration: MigrationRecord | null, flipped: boolean): Step => ({
  id: 'announced',
  label: migration ? `announced ${day(BigInt(migration.announcedAt))}` : 'not announced',
  state: migration || flipped ? 'done' : 'pending',
  detail: migration && !flipped ? `flip expected around ${day(BigInt(migration.expectedFlipAt))}` : undefined,
});

const flipStep = (v: VersionFlows, flipped: boolean): Step => ({
  id: 'flip',
  label: flipped ? `flipped ${day(v.flipAt)}` : 'the flip',
  state: flipped ? 'done' : 'pending',
});

/** Ethereum knows the message was sent, not that the miner consumed it: the label says as much. */
const retireStep = (v: VersionFlows, flipped: boolean): Step => ({
  id: 'retire',
  label: v.retireSent ? 'retire message sent' : 'the retire message ends mining',
  state: v.retireSent ? 'done' : flipped ? 'active' : 'pending',
  detail: v.retireSent ? 'mining ends once the miner consumes it' : undefined,
});

const closesStep = (v: VersionFlows, nowSeconds: number): Step => {
  const closes = v.deadline !== OPEN_ENDED;
  return {
    id: 'closes',
    label: closes ? `exits close ${day(v.deadline)}` : 'exits open until the version after next',
    state: closed(v, nowSeconds) ? 'done' : closes ? 'active' : 'pending',
  };
};
