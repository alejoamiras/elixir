// The bridge page's one read and its sentences, pure over an injected reader; the extras the
// page draws (YACA's supply, every crossing's event with its time) arrive beside it, and the
// figures of the tiles, the bar and the chart are derived here from both.

import type { PortalPolicy, PortalReader, VersionFlows } from '../../bridge/src/portal-reader.ts';
import type { MigrationRecord } from '../../bridge/src/record.ts';
import { PARAMS } from '../../miner-core/src/generated/params.ts';
import type { EpochRow } from '../../miner-core/src/reader.ts';
import { amount, duration } from '../../site/src/browser/format.ts';
import type { BarSegment, TimelineItem } from '../../ui/src/bridge-types.ts';

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
  /** The reads the page draws from: absent when they failed, the sentences stand without them. */
  extras?: BridgeExtras;
}

/** One crossing as the portal recorded it: what kind, for which version, how much, when. */
export interface FlowEvent {
  kind: 'exit' | 'send' | 'deposit' | 'redeem';
  version: bigint;
  amount: bigint;
  /** Unix seconds of the block. */
  at: number;
}

export interface BridgeExtras {
  /** YACA's total supply on Ethereum: what is there right now. */
  yacaSupply: bigint;
  events: FlowEvent[];
  /** Unix seconds of the last forward, or null when none happened yet. */
  lastForwardAt: number | null;
}

/** What the miner's own counters say: everything that ever left through the portal, everything that arrived. */
export interface MinerFlows {
  exited: bigint;
  claimedFromL1: bigint;
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
const whole = (raw: bigint): string => amount(raw, PARAMS.DECIMALS, 0);
export const day = (unix: bigint | number): string =>
  new Date(Number(unix) * 1000).toISOString().slice(0, 10);
/** "Sep 5", for a timeline's dates. */
export const shortDay = (unix: bigint | number): string =>
  new Date(Number(unix) * 1000).toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
/** The portal's "never" for a deadline: the max uint256. */
const OPEN_ENDED = (1n << 256n) - 1n;
const max0 = (v: bigint): bigint => (v < 0n ? 0n : v);

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
      : 'the live version · mining, deposits and exits here';
  if (v.flipAt > 0n)
    return v.deadline === OPEN_ENDED
      ? `flipped away from on ${day(v.flipAt)} · exits stay open`
      : `flipped away from on ${day(v.flipAt)} · exits close on ${day(v.deadline)}`;
  if (v.registryIndex < canonical.index) return 'flipped away from · the flip not yet recorded on the portal';
  return 'registered ahead of the flip · not live yet';
}

// ---------------------------------------------------------------- the phases

const launchedPhase = (v: VersionFlows, nowSeconds: number): TimelineItem => {
  const ahead = v.launchAt > BigInt(nowSeconds);
  return {
    id: 'launched',
    label: 'launched',
    state: ahead ? 'on' : 'done',
    detail: `${shortDay(v.launchAt)} · ${ahead ? 'the schedule starts' : 'epoch 0 opened'}`,
  };
};

const announcedPhase = (m: MigrationRecord | null, flipped: boolean, next: string): TimelineItem => ({
  id: 'announced',
  label: m ? `${next} announced` : 'not announced',
  state: m || flipped ? 'done' : 'todo',
  detail: m
    ? `${shortDay(BigInt(m.announcedAt))} · send ahead before ${shortDay(BigInt(m.expectedFlipAt))}`
    : 'mining goes on until a next version is named',
});

const flipPhase = (
  v: VersionFlows,
  m: MigrationRecord | null,
  flipped: boolean,
  next: string,
): TimelineItem => ({
  id: 'flip',
  label: `${next} canonical`,
  state: flipped ? 'done' : m ? 'on' : 'todo',
  detail: flipped
    ? `${shortDay(v.flipAt)} · mining on V${v.version} ended`
    : `${m ? `~${shortDay(BigInt(m.expectedFlipAt))} · ` : ''}mining on V${v.version} ends`,
});

/** Going quiet is the version's last proof, which nothing announces; the retire message (mining's end) is only its omen, so the phase is never done. */
const retirePhase = (v: VersionFlows, flipped: boolean): TimelineItem => ({
  id: 'retire',
  label: `V${v.version} goes quiet`,
  state: flipped ? 'on' : 'todo',
  detail: v.retireSent
    ? 'retire message sent · mining ends when the miner consumes it · proving may stop any time'
    : 'days later · nothing can leave',
});

const closesPhase = (v: VersionFlows, nowSeconds: number): TimelineItem => {
  const dated = v.deadline !== OPEN_ENDED;
  return {
    id: 'closes',
    label: 'exits close',
    state: closed(v, nowSeconds) ? 'done' : dated ? 'on' : 'todo',
    detail: dated
      ? `${shortDay(v.deadline)} · plus paused days`
      : 'the later of the version after next and 180 d after the flip · plus paused days',
  };
};

/**
 * A version's life as a timeline: the launch (from the portal's registration), the announcement
 * (from the build's record, when it carries one), the flip, the retire message, the day its exits close.
 */
export function phasesOf(v: VersionFlows, m: MigrationRecord | null, nowSeconds: number): TimelineItem[] {
  const flipped = v.flipAt > 0n;
  const next = m ? `V${m.toIndex}` : 'the next version';
  return [
    launchedPhase(v, nowSeconds),
    announcedPhase(m, flipped, next),
    flipPhase(v, m, flipped, next),
    retirePhase(v, flipped),
    closesPhase(v, nowSeconds),
  ];
}

// ---------------------------------------------------------------- what the page draws

const sum = (events: FlowEvent[], kinds: FlowEvent['kind'][], until = Number.POSITIVE_INFINITY): bigint =>
  events.filter((e) => kinds.includes(e.kind) && e.at <= until).reduce((a, e) => a + e.amount, 0n);

export interface Kpi {
  id: string;
  label: string;
  value: string;
  unit?: string;
  sub: string;
}

const percent = (part: bigint, whole: bigint): string =>
  whole === 0n ? '0 %' : `${(Number((part * 1000n) / whole) / 10).toFixed(0)} %`;

/** The figures every tile draws from, each undefined when its read is missing. */
export interface BridgeFigures {
  onEthereum?: bigint;
  /** Everything the miner ever minted by mining: its supply, less what came from Ethereum, plus what left. */
  mined?: bigint;
  /** Left the miner, not yet through the portal. */
  transit?: bigint;
  /** Through the portal, not yet claimed on the miner. */
  waiting?: bigint;
  forwards?: number;
  /** Unix seconds of the last forward; null when none happened; undefined when the history could not be read. */
  lastForwardAt?: number | null;
}

export function figuresOf(
  s: BridgeSnapshot,
  live: VersionFlows | undefined,
  miner: MinerFlows | undefined,
  supply: bigint | undefined,
): BridgeFigures {
  const x = s.extras;
  const mine = (e: FlowEvent) => !live || e.version === live.version;
  return {
    onEthereum: x?.yacaSupply,
    mined: supply !== undefined && miner ? supply - miner.claimedFromL1 + miner.exited : undefined,
    transit: miner && live ? max0(miner.exited - live.exited) : undefined,
    waiting: miner && live ? max0(live.inbound - miner.claimedFromL1) : undefined,
    forwards: x ? x.events.filter((e) => e.kind !== 'deposit' && mine(e)).length : undefined,
    lastForwardAt: x ? x.lastForwardAt : undefined,
  };
}

const DASH = '—';

/** At most `max` of `sorted`, evenly spaced, the first and the last always among them. */
export function sampleBlocks(sorted: readonly bigint[], max: number): bigint[] {
  if (sorted.length <= max) return [...sorted];
  const step = Math.ceil((sorted.length - 1) / (max - 1));
  const picked = sorted.filter((_, i) => i % step === 0);
  const last = sorted[sorted.length - 1] as bigint;
  if (picked[picked.length - 1] !== last) picked.push(last);
  return picked;
}
const figure = (raw: bigint | undefined): string => (raw === undefined ? DASH : whole(raw));

/** "forwarded 2 min ago", "nothing forwarded yet", or that the history could not be read. */
export const forwardingLine = (lastForwardAt: number | null | undefined, nowSeconds: number): string =>
  lastForwardAt === undefined
    ? 'forwarding history unavailable'
    : lastForwardAt
      ? `forwarded ${duration(Math.max(0, nowSeconds - lastForwardAt))} ago`
      : 'nothing forwarded yet';

const ethereumKpi = (f: BridgeFigures, chain: string): Kpi => ({
  id: 'ethereum',
  label: 'on Ethereum',
  value: figure(f.onEthereum),
  unit: 'YACA',
  sub: `an ERC-20 on ${chain}${
    f.onEthereum !== undefined && f.mined !== undefined && f.mined > 0n
      ? ` · ${percent(f.onEthereum, f.mined)} of all minted`
      : ''
  }`,
});

const aztecKpi = (
  f: BridgeFigures,
  miner: MinerFlows | undefined,
  supply: bigint | undefined,
  v: string,
): Kpi => ({
  id: 'aztec',
  label: `on Aztec ${v}`,
  value: figure(supply),
  unit: PARAMS.TOKEN_SYMBOL,
  sub:
    f.mined !== undefined && miner
      ? `${whole(f.mined)} mined − ${whole(miner.exited)} left + ${whole(miner.claimedFromL1)} came back`
      : 'the private balances, in sum',
});

const transitKpi = (f: BridgeFigures): Kpi => ({
  id: 'transit',
  label: 'in transit',
  value: figure(f.transit),
  unit: PARAMS.TOKEN_SYMBOL,
  sub: f.transit === 0n ? 'nothing between the two' : 'left the miner, not yet forwarded',
});

const waitingKpi = (f: BridgeFigures): Kpi => ({
  id: 'waiting',
  label: 'waiting to be claimed',
  value: figure(f.waiting),
  unit: PARAMS.TOKEN_SYMBOL,
  sub: f.waiting === 0n ? 'every arrival claimed' : 'on Aztec, unclaimed',
});

const bridgeKpi = (
  f: BridgeFigures,
  s: BridgeSnapshot,
  live: VersionFlows | undefined,
  nowSeconds: number,
): Kpi => ({
  id: 'bridge',
  label: 'bridge',
  value: live?.paused ? 'paused' : 'open',
  sub: `${forwardingLine(f.lastForwardAt, nowSeconds)} · paused ${duration(Number(live?.pausedSeconds ?? 0n))} of ${duration(Number(s.policy.pauseBudget))}`,
});

const leftKpi = (f: BridgeFigures, live: VersionFlows | undefined, v: string): Kpi => ({
  id: 'left',
  label: `left ${v}`,
  value: live ? whole(live.exited) : DASH,
  unit: PARAMS.TOKEN_SYMBOL,
  sub:
    f.forwards === undefined
      ? 'exits and send-aheads forwarded on'
      : `${f.forwards} ${f.forwards === 1 ? 'forward' : 'forwards'} · ${live && live.headroom === 0n ? 'exits wait for headroom' : 'headroom under the limit'}`,
});

/**
 * The six figures: what is on Ethereum (YACA's supply), what is on the live version, what is in
 * transit (left the miner, not yet through the portal), what waits to be claimed (through the
 * portal, not yet claimed on the miner), the bridge's state, what left the live version.
 */
export function kpisOf(
  s: BridgeSnapshot,
  live: VersionFlows | undefined,
  miner: MinerFlows | undefined,
  supply: bigint | undefined,
  nowSeconds: number,
  chain: string,
): Kpi[] {
  const f = figuresOf(s, live, miner, supply);
  const v = live ? `V${live.version}` : 'this version';
  return [
    ethereumKpi(f, chain),
    aztecKpi(f, miner, supply, v),
    transitKpi(f),
    waitingKpi(f),
    bridgeKpi(f, s, live, nowSeconds),
    leftKpi(f, live, v),
  ];
}

/** Where a version's coins are, for its stacked bar: still here, left to Ethereum net, crossing, moved to the next version. The miner read is `built`'s; another version's supply and transit are unknown here, not zero. */
export function whereOf(
  v: VersionFlows,
  s: BridgeSnapshot,
  miner: MinerFlows | undefined,
  supply: bigint | undefined,
  built: string,
): BarSegment[] {
  const events = s.extras ? s.extras.events.filter((e) => e.version === v.version) : [];
  const toEth = max0(sum(events, ['exit', 'redeem']) - sum(events, ['deposit']));
  const moved = sum(events, ['send']);
  const mine = v.version === built;
  const here = mine ? supply : undefined;
  const transit = mine && miner ? max0(miner.exited - v.exited) : undefined;
  const n = (raw: bigint | undefined) =>
    raw === undefined ? 0 : Number(raw / 10n ** BigInt(Math.max(0, PARAMS.DECIMALS - 6)));
  const shown = (raw: bigint | undefined) => (raw === undefined ? DASH : whole(raw));
  return [
    { id: 'here', label: `still on V${v.version}`, figure: shown(here), value: n(here), color: 'var(--uv)' },
    {
      id: 'eth',
      label: 'left to Ethereum, net',
      figure: whole(toEth),
      value: n(toEth),
      color: 'var(--ink-3)',
    },
    { id: 'transit', label: 'crossing', figure: shown(transit), value: n(transit), color: 'var(--warn)' },
    {
      id: 'moved',
      label: 'moved to the next version',
      figure: whole(moved),
      value: n(moved),
      color: 'var(--uv-2)',
    },
  ];
}

export interface CoinsPoint {
  /** Unix seconds. */
  t: number;
  /** Whole tokens. */
  aztec: number;
  ethereum: number;
  total: number;
}

const tokens = (raw: bigint): number =>
  Number(raw / 10n ** BigInt(Math.max(0, PARAMS.DECIMALS - 4))) / 10 ** Math.min(4, PARAMS.DECIMALS);

/**
 * Where the coins are: the emission of the epochs held (each epoch's claims counted at its open,
 * times the reward) against what is on Ethereum by then (exits and redeems, less deposits); the rest
 * is on Aztec. One point per epoch open and per crossing, the last at `now`. When the rows start
 * after launch the emission is short by the missing epochs: nothing is clipped, the caller says so.
 */
export function coinsSeries(
  rows: readonly EpochRow[],
  events: FlowEvent[],
  nowSeconds: number,
): CoinsPoint[] {
  const epochs = [...rows].sort((a, b) => a.epoch - b.epoch);
  const first = epochs[0];
  if (!first) return [];
  const times = new Set<number>([...epochs.map((r) => r.openedAt), ...events.map((e) => e.at), nowSeconds]);
  const points: CoinsPoint[] = [];
  for (const t of [...times].sort((a, b) => a - b)) {
    if (t < first.openedAt) continue;
    const claims = epochs.filter((r) => r.openedAt <= t).reduce((a, r) => a + BigInt(r.claims), 0n);
    const total = claims * PARAMS.REWARD;
    const onEth = max0(sum(events, ['exit', 'redeem'], t) - sum(events, ['deposit'], t));
    points.push({ t, total: tokens(total), ethereum: tokens(onEth), aztec: tokens(max0(total - onEth)) });
  }
  return points;
}
