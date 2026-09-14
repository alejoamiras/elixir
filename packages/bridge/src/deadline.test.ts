import { describe, expect, test } from 'bun:test';
import {
  checkpointProven,
  epochProven,
  missedDeadline,
  proofDeadline,
  type RollupReads,
} from './deadline.ts';

/** A rollup whose epochs hold four checkpoints, proven up to `proven`. */
const rollup = (proven: bigint): RollupReads => ({
  proofSubmissionEpochs: async () => 1n,
  timestampForEpoch: async (epoch) => 1_000n * epoch,
  provenCheckpoint: async () => proven,
  epochOfCheckpoint: async (checkpoint) => checkpoint / 4n,
});

describe('settlement on Ethereum', () => {
  test('an epoch is proven checkpoint by checkpoint: the epoch says begun, the checkpoint says covered', async () => {
    // Checkpoint 9 proven: epoch 2 has begun to land; checkpoint 11 of the same epoch has not.
    expect(await epochProven(rollup(9n), 2n)).toBe(true);
    expect(await checkpointProven(rollup(9n), 9n)).toBe(true);
    expect(await checkpointProven(rollup(9n), 11n)).toBe(false);
    expect(await epochProven(rollup(9n), 3n)).toBe(false);
    expect(await epochProven(rollup(0n), 0n)).toBe(false);
    expect(await checkpointProven(rollup(0n), 0n)).toBe(false);
  });

  test('the deadline is the epoch after the submission window; missed only once past it unproven', async () => {
    expect(await proofDeadline(rollup(0n), 2n)).toBe(4_000n);
    expect(missedDeadline(4_000n, false, 4_001n)).toBe(true);
    expect(missedDeadline(4_000n, true, 4_001n)).toBe(false);
    expect(missedDeadline(4_000n, false, 3_999n)).toBe(false);
  });
});
