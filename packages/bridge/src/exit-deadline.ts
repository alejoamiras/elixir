// The portal's exit deadline as a reading, never as an announced date: it is the later of the
// version after next arriving and the flip plus the floor, both pushed back by every paused second,
// and it is unset until both transitions are recorded (`YacanaPortal.deadline` returns the uint256
// max meanwhile). The four readings come from those recorded transitions and the pause accounting
// alone, in one L1 block; a shown date is read again at every refresh because an unpause refunds
// the seconds it did not use.

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
