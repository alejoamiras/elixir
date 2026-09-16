// The portal's exit deadline, read rather than announced: an unpause refunds the seconds it did
// not use, so every refresh reads it again and no date is ever promised. Its inputs must come from
// one L1 block — a transition recorded between two of them gives a deadline that never existed.
import { policyFor } from './policy.ts';

/** The portal's "never": what `deadline()` returns while a transition is unrecorded. */
export const OPEN_ENDED = (1n << 256n) - 1n;

export interface DeadlineFacts {
  /** The flip's observation on the portal; zero while unrecorded. */
  flipAt: bigint;
  /** The version after next's observation; zero while unrecorded. */
  afterNextAt: bigint;
  /** Seconds of pause spent on the version so far. */
  pausedSeconds: bigint;
  /** The portal's `EXIT_FLOOR`, in seconds. */
  floor: bigint;
  /** Ethereum's clock at the read: a device clock could declare a version closed early. */
  l1Now: bigint;
}

export type DeadlineReading =
  /** No flip recorded: open for at least the floor after the upgrade. */
  | { kind: 'no-flip' }
  /** Flipped, the version after next unseen, the floor ahead: open until at least `until`. */
  | { kind: 'floor'; until: bigint }
  /** Past the floor with the version after next unseen: its observation closes the version. */
  | { kind: 'any-day' }
  /** Both transitions recorded: a date, plus the paused seconds; `closed` once Ethereum is past it. */
  | { kind: 'set'; at: bigint; closed: boolean };

/** The deadline as the contract computes it, or null while it is open-ended. */
export const exitDeadline = (s: DeadlineFacts): bigint | null => {
  if (s.flipAt === 0n || s.afterNextAt === 0n) return null;
  const floor = s.flipAt + s.floor;
  return (s.afterNextAt > floor ? s.afterNextAt : floor) + s.pausedSeconds;
};

/** Pure over one block's facts; the uint256 max is never a date. `closed` is `l1Now > at`: the portal admits equality. */
export function readDeadline(s: DeadlineFacts): DeadlineReading {
  if (s.flipAt === 0n) return { kind: 'no-flip' };
  const at = exitDeadline(s);
  if (at !== null) return { kind: 'set', at, closed: s.l1Now > at };
  const until = s.flipAt + s.floor + s.pausedSeconds;
  return s.l1Now > until ? { kind: 'any-day' } : { kind: 'floor', until };
}

const FLOOR_DAYS = Number(policyFor().exitFloor / 86_400n);

/** "Sep 20", in UTC: a date the user is told to expect, never a time of day. */
export const dayOf = (unixSeconds: bigint): string =>
  new Date(Number(unixSeconds) * 1000).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * The version's last day, in the four readings the portal allows. Never a bare date while the
 * upgrade after the next one is unrecorded: that observation can still push the date out, and every
 * paused day pushes it further — so the phrase says what is guaranteed and what could extend it.
 */
export const deadlinePhrase = (d: DeadlineReading | undefined, after: string): string => {
  if (!d) return 'while the bridge is open';
  if (d.kind === 'no-flip')
    return `for at least ${FLOOR_DAYS} days after the upgrade; after that, until the upgrade after ${after} lands`;
  if (d.kind === 'floor')
    return `until at least ${dayOf(d.until)} (${FLOOR_DAYS} days after the upgrade); after that day, until the upgrade after ${after} lands`;
  if (d.kind === 'any-day') return 'until the next Aztec upgrade, which could land any day';
  return `until ${dayOf(d.at)} (the upgrade after ${after} has already landed; later only by the days the bridge was paused)`;
};
