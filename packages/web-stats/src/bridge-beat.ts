// The bridge page's one read: every version Yacana registered on the portal with what crossed it
// and what its turnstile allows now, the Registry's canonical version, the fixed policy and the
// keys. Pure over an injected reader; the sentences the tiles print are here too, so the words
// are tested without a page.

import type { PortalPolicy, PortalReader, VersionFlows } from '../../bridge/src/portal-reader.ts';
import type { MigrationRecord } from '../../bridge/src/record.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import { amount, duration } from '../../site/src/browser/format.ts';

/** One line of the phases timeline; the shape the Stepper draws, with plain text for labels. */
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
  /** Wall clock (ms) of the read. */
  readAt: number;
}

type BridgeReads = Pick<
  PortalReader,
  'registered' | 'flows' | 'canonical' | 'policy' | 'operators' | 'forwarders'
>;

/** Everything the page shows, read together; a version list read first, its flows in parallel. */
export async function readBridge(reader: BridgeReads, now = Date.now()): Promise<BridgeSnapshot> {
  const [registered, canonical, policy, operators, forwarders] = await Promise.all([
    reader.registered(),
    reader.canonical(),
    reader.policy(),
    reader.operators(),
    reader.forwarders(),
  ]);
  const versions = await Promise.all(registered.map((v) => reader.flows(v)));
  return { versions, canonical, policy, operators, forwarders, readAt: now };
}

const yaca = (raw: bigint): string => `${amount(raw, PARAMS.DECIMALS, 2)} ${PARAMS.TOKEN_SYMBOL}`;
const day = (unix: bigint): string => new Date(Number(unix) * 1000).toISOString().slice(0, 10);
/** The portal's "never" for a deadline: the max uint256. */
const OPEN_ENDED = (1n << 256n) - 1n;

/** The turnstile in one sentence: what may leave now, and that the rest waits rather than fails. */
export function exitLimitLine(v: VersionFlows, policy: PortalPolicy): string {
  const may = `${yaca(v.headroom)} may leave V${v.version} right now`;
  if (v.flipAt > 0n)
    return `${may} · the limit stopped growing at the flip; ${yaca(v.exited)} has left. Exits beyond it wait.`;
  return `${may} · grows ${yaca(policy.perHour)} an hour; exits beyond it wait, they are not refused.`;
}

/** The pause in one sentence: whether it is on, and what the operators may do with it. */
export function pauseLine(v: VersionFlows, policy: PortalPolicy, nowSeconds: number): string {
  const limits = `the operators may pause exits and deposits for up to ${duration(Number(policy.pauseMax))} at a time, ${duration(Number(policy.pauseBudget))} in total per version`;
  if (v.pausedUntil > BigInt(nowSeconds))
    return `paused for ${duration(Number(v.pausedUntil) - nowSeconds)} more · ${duration(Number(v.pausedSeconds))} of the budget spent · ${limits}`;
  return `not paused · ${limits}`;
}

/** Where a version stands, as its card's second line. */
export function versionLine(v: VersionFlows, canonical: bigint): string {
  if (!v.registered) return 'not registered on the portal yet';
  if (v.version === canonical)
    return v.depositsClosed
      ? 'the live version · deposits closed before the flip'
      : 'the live version · mining, deposits and exits here';
  if (v.flipAt > 0n)
    return v.deadline === OPEN_ENDED
      ? `flipped away from on ${day(v.flipAt)} · exits stay open`
      : `flipped away from on ${day(v.flipAt)} · exits close on ${day(v.deadline)}`;
  return 'registered, not live yet';
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

const retireStep = (v: VersionFlows, flipped: boolean): Step => ({
  id: 'retire',
  label: v.retireSent ? 'retire message sent: mining ended' : 'mining ends with the retire message',
  state: v.retireSent ? 'done' : flipped ? 'active' : 'pending',
});

const closesStep = (v: VersionFlows, nowSeconds: number): Step => {
  const closes = v.deadline !== OPEN_ENDED;
  const closed = closes && BigInt(nowSeconds) > v.deadline;
  return {
    id: 'closes',
    label: closes ? `exits close ${day(v.deadline)}` : 'exits open until the version after next',
    state: closed ? 'done' : closes ? 'active' : 'pending',
  };
};
