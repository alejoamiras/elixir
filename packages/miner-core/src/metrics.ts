// The numbers the interface shows, defined once. Pure; every surface imports these.
import type { Fr } from '@aztec/foundation/curves/bn254';
import { low128 } from './proof.ts';
import type { EpochRow } from './reader.ts';
import { cappedElapsed, type EpochRules, nextTarget } from './retarget.ts';

const TWO_128 = 2 ** 128;
const RECENT = 20;

/** 2^128 / low128(digest); the contract's `low128 < target` is `score > difficulty`. */
export const score = (digest: Fr): number => {
  const low = low128(digest);
  return low === 0n ? Number.POSITIVE_INFINITY : TWO_128 / Number(low);
};

/** Expected proofs per winning ticket, 2^128 / target: "the bar". */
export const difficulty = (target: bigint): number => TWO_128 / Number(target);

/** Over the last RECENT prove durations (ms); 0 when idle. */
export const proofsPerMinute = (recentMs: readonly number[]): number => {
  const window = recentMs.slice(-RECENT);
  if (!window.length) return 0;
  return 60_000 / (window.reduce((a, b) => a + b, 0) / window.length);
};

/** "At this rate": difficulty / rate; Infinity when idle. */
export const nextWinSeconds = (target: bigint, perMinute: number): number =>
  perMinute > 0 ? (difficulty(target) * 60) / perMinute : Number.POSITIVE_INFINITY;

/** If the epoch closed now: the next difficulty as a ratio of the current one, clamp included. */
export const closePreview = (target: bigint, elapsedSeconds: bigint, rules: EpochRules): number =>
  difficulty(nextTarget(target, cappedElapsed(elapsedSeconds, rules), rules)) / difficulty(target);

/** Seconds until anyone may roll the epoch; ≤ 0 once T_MAX has passed. */
export const escapeHatchIn = (openedAt: bigint, tMax: bigint, now: bigint): bigint => openedAt + tMax - now;

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
};

const NETWORK_EPOCHS = 6;

/**
 * The network's proof rate implied by the last closed epochs: n × difficulty / duration each,
 * median of the last NETWORK_EPOCHS (one epoch swings ×3 on luck alone at N = 4); null before
 * any epoch closed by claims. Epochs closed by roll() say nothing about the rate.
 */
export const networkRate = (closed: readonly EpochRow[], n: number): number | null =>
  median(
    closed
      .filter((r) => r.closedBy === 'claims' && r.duration !== null && r.duration > 0)
      .slice(-NETWORK_EPOCHS)
      .map((r) => (n * difficulty(r.target)) / (r.duration as number)),
  );

/** Claims that landed in the last hour, from the closed epochs' counts; the open one has no end. */
export const claimsPerHour = (rows: readonly EpochRow[], nowSec: number): number => {
  const since = nowSec - 3600;
  let claims = 0;
  for (const r of rows) {
    if (r.duration === null) continue;
    const end = r.openedAt + r.duration;
    if (end <= since) continue;
    // A closed epoch's claims are spread evenly over its span; count the part inside the hour.
    const inside = Math.min(end, nowSec) - Math.max(r.openedAt, since);
    claims += (r.claims * inside) / r.duration;
  }
  return claims;
};

/** The schedule: claims per hour when every epoch closes on time. */
export const scheduledClaimsPerHour = (rules: EpochRules): number =>
  (rules.N * 3600) / Number(rules.EXPECTED_EPOCH_SECONDS);

/** Your share of the network, the expected wait for a win, and the expected reward per day. */
export function calculator(
  yourPerMinute: number,
  networkPerSecond: number,
  target: bigint,
  rules: EpochRules & { REWARD: bigint },
): { share: number; secondsToWin: number; perDay: bigint } {
  const yours = yourPerMinute / 60;
  const share = networkPerSecond > 0 ? yours / networkPerSecond : yours > 0 ? 1 : 0;
  const perDay = (BigInt(rules.N) * rules.REWARD * 86_400n) / rules.EXPECTED_EPOCH_SECONDS;
  return {
    share,
    secondsToWin: nextWinSeconds(target, yourPerMinute),
    perDay: (perDay * BigInt(Math.round(Math.min(share, 1) * 1_000_000))) / 1_000_000n,
  };
}

export type SentenceKind = 'open' | 'launch' | 'rolled' | 'fast' | 'slow' | 'normal';

/** How an epoch went, from its closing facts alone; the retarget clamp marks the extremes. */
export function sentenceKind(row: EpochRow): SentenceKind {
  if (row.duration === null || row.retarget === null) return 'open';
  if (row.closedBy === 'roll') return 'rolled';
  if (row.epoch === 0) return 'launch';
  const harder = 1 / row.retarget;
  return harder > 1.25 ? 'fast' : harder < 0.8 ? 'slow' : 'normal';
}

const minutes = (s: number): string => (s >= 90 ? `${(s / 60).toFixed(s >= 600 ? 0 : 1)} min` : `${s} s`);
const clock = (unix: number): string => new Date(unix * 1000).toISOString().slice(11, 19);

/** One sentence per epoch, from its numbers; the templates are the whole vocabulary. */
export function sentence(row: EpochRow, rules: EpochRules): string {
  const expected = minutes(Number(rules.EXPECTED_EPOCH_SECONDS));
  const kind = sentenceKind(row);
  if (kind === 'open')
    return `Open with ${row.claims} of ${rules.N} claims; it closes at the ${ordinal(rules.N)} claim, expected about ${expected} after it opened.`;
  const dur = minutes(row.duration as number);
  const harder = 1 / (row.retarget as number);
  const move =
    harder >= 1 ? `×${harder.toFixed(2)} harder` : `×${(row.retarget as number).toFixed(2)} easier`;
  switch (kind) {
    case 'rolled':
      return `Hashrate fell away after ${row.claims} ${row.claims === 1 ? 'claim' : 'claims'}. The epoch sat open past T_MAX and anyone could close it; someone did at ${clock(row.openedAt + (row.duration as number))}, taking the maximum ×4 easing.`;
    case 'launch':
      return `Epoch 0 opened at launch at difficulty ${difficulty(row.target).toFixed(1)}; ${rules.N} claims closed it in ${dur} against ${expected} expected, and the first retarget made the next epoch ${move}.`;
    case 'fast':
      return `${rules.N} claims in ${dur} against ${expected} expected: the network was faster than the target assumed, so the next epoch was made ${move}.`;
    case 'slow':
      return `${rules.N} claims took ${dur} against ${expected} expected: the next epoch was eased ${move.replace(' easier', '')}.`;
    default:
      return `${rules.N} claims in ${dur}, close to the ${expected} expected; the target moved ${move.replace(' harder', '').replace(' easier', '')}.`;
  }
}

const ordinal = (n: number): string =>
  `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'] as const)[n % 10 < 4 ? n % 10 : 0]}`;
