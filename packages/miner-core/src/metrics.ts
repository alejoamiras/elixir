// The numbers the interface shows, defined once. Pure; every surface imports these.
import type { Fr } from '@aztec/foundation/curves/bn254';
import { low128 } from './proof.ts';
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
