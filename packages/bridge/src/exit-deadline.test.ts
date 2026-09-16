import { describe, expect, test } from 'bun:test';
import { type DeadlineFacts, exitDeadline, OPEN_ENDED, readDeadline } from './exit-deadline.ts';

const DAY = 86_400n;
const FLOOR = 180n * DAY;
const facts = (over: Partial<DeadlineFacts> = {}): DeadlineFacts => ({
  flipAt: 0n,
  afterNextAt: 0n,
  pausedSeconds: 0n,
  floor: FLOOR,
  l1Now: 1_000_000n,
  ...over,
});

describe("the exit deadline's four readings", () => {
  test('no flip; the floor ahead; past the floor with the version after next unseen; set', () => {
    expect(readDeadline(facts())).toEqual({ kind: 'no-flip' });
    const flip = 1_000_000n;
    expect(readDeadline(facts({ flipAt: flip, l1Now: flip + 10n * DAY }))).toEqual({
      kind: 'floor',
      until: flip + FLOOR,
    });
    expect(readDeadline(facts({ flipAt: flip, l1Now: flip + FLOOR + 1n }))).toEqual({ kind: 'any-day' });
    // The version after next observed before the floor: the floor is the date.
    expect(
      readDeadline(facts({ flipAt: flip, afterNextAt: flip + 30n * DAY, l1Now: flip + 40n * DAY })),
    ).toEqual({ kind: 'set', at: flip + FLOOR, closed: false });
    // Observed after the floor: the observation itself is the date.
    const late = flip + FLOOR + 5n * DAY;
    expect(readDeadline(facts({ flipAt: flip, afterNextAt: late, l1Now: late }))).toEqual({
      kind: 'set',
      at: late,
      closed: false,
    });
  });

  test("equals the contract's arithmetic: the later of the two, plus paused seconds; closed strictly after it", () => {
    // YacanaPortal.deadline: max(next, flip + EXIT_FLOOR) + pausedSeconds; _requireOpen is `<=`.
    const flip = 5_000_000n;
    const paused = 3n * DAY;
    const s = facts({ flipAt: flip, afterNextAt: flip + 200n * DAY, pausedSeconds: paused });
    expect(exitDeadline(s)).toBe(flip + 200n * DAY + paused);
    expect(readDeadline({ ...s, l1Now: flip + 203n * DAY })).toMatchObject({ kind: 'set', closed: false });
    expect(readDeadline({ ...s, l1Now: flip + 203n * DAY + 1n })).toMatchObject({
      kind: 'set',
      closed: true,
    });
    // The floor reading carries the paused seconds too: the contract never closes before them.
    expect(readDeadline(facts({ flipAt: flip, pausedSeconds: paused, l1Now: flip + FLOOR + DAY }))).toEqual({
      kind: 'floor',
      until: flip + FLOOR + paused,
    });
  });

  test('an unpause refunds unused seconds: the date read again moves earlier', () => {
    const flip = 5_000_000n;
    const before = readDeadline(facts({ flipAt: flip, afterNextAt: flip + DAY, pausedSeconds: 10n * DAY }));
    const after = readDeadline(facts({ flipAt: flip, afterNextAt: flip + DAY, pausedSeconds: 4n * DAY }));
    expect(before).toMatchObject({ kind: 'set', at: flip + FLOOR + 10n * DAY });
    expect(after).toMatchObject({ kind: 'set', at: flip + FLOOR + 4n * DAY });
  });

  test('the max sentinel is never a date: unrecorded transitions read as open-ended, whatever the clock', () => {
    expect(exitDeadline(facts({ flipAt: 7n }))).toBeNull();
    expect(exitDeadline(facts({ afterNextAt: 7n }))).toBeNull();
    expect(readDeadline(facts({ afterNextAt: 7n, l1Now: OPEN_ENDED - 1n })).kind).toBe('no-flip');
    expect(readDeadline(facts({ flipAt: 7n, l1Now: OPEN_ENDED - 1n })).kind).toBe('any-day');
  });
});
