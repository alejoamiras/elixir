import { AztecAddress } from '@aztec/aztec.js/addresses';
import { Fr } from '@aztec/aztec.js/fields';
import { describe, expect, test } from 'vitest';
import { CHUNK, type Node, type SlotTable, type StorageLayout } from '../../miner-core/src/reader.ts';
import { pollChain, type Reader, readOlder, WINDOW } from './chain';
import type { Chain } from './state';

// Slots need no hashing here: any distinct field per epoch will do for a fake node.
const table: SlotTable = {
  first: 0,
  epochs: Array.from({ length: CHUNK }, (_, e) => new Fr(1_000_000n + BigInt(e) * 4n)),
  claims: Array.from({ length: CHUNK }, (_, e) => new Fr(3_000_000n + BigInt(e))),
};
const layout: StorageLayout = { open_epoch: { slot: new Fr(15) }, total_supply: { slot: new Fr(8) } };

/** A chain whose epoch `e` opened at `e × 300` with 4 claims (the open one 1), target 2^122. */
function fakeReader(open: number, opts: { failHistory?: boolean } = {}) {
  const values = new Map<string, bigint>([
    [new Fr(15).toString(), BigInt(open)],
    [new Fr(8).toString(), 4n * 10n ** 18n * BigInt(open * 4)],
  ]);
  for (let e = 0; e <= open; e++) {
    const base = (table.epochs[e] as Fr).toBigInt();
    values.set(new Fr(base).toString(), 1n << 122n);
    values.set(new Fr(base + 2n).toString(), BigInt(e * 300));
    values.set((table.claims[e] as Fr).toString(), e === open ? 1n : 4n);
  }
  const node = {
    getPublicStorageAt: async (_b: unknown, _c: unknown, slot: Fr) =>
      new Fr(values.get(slot.toString()) ?? 0n),
    getBlockData: async () => ({
      header: { globalVariables: { blockNumber: 99, timestamp: BigInt(open * 300 + 10) } },
    }),
  } as unknown as Node;
  const reader: Reader = {
    node,
    miner: AztecAddress.fromBigIntUnsafe(7n),
    token: AztecAddress.fromBigIntUnsafe(8n),
    minerLayout: layout,
    tokenLayout: layout,
    load: async () => {
      if (opts.failHistory) throw new Error('chunk 0: 503');
      return table;
    },
  };
  return reader;
}

const held = (rows: number[], open: number): Chain => ({
  rows: rows.map((e) => ({
    epoch: e,
    target: 1n << 122n,
    openedAt: e * 300,
    claims: 4,
    duration: 300,
    retarget: 1,
    closedBy: 'claims',
  })),
  open,
  supply: 0n,
  genesis: { target: 0n, seed: 0n, launchAt: 0 },
  lottery: { mix: 0n, reveals: 0 },
  block: { number: 1, timestamp: 0 },
  readAt: 0,
});

describe('pollChain', () => {
  test('a close since the last read joins the tail; the previous row closes', async () => {
    const chain = held([10, 11, 12], 12);
    const { chain: next, historyError } = await pollChain(fakeReader(13), chain);
    expect(historyError).toBeUndefined();
    expect(next.rows.map((r) => r.epoch)).toEqual([10, 11, 12, 13]);
    expect(next.rows[2]).toMatchObject({ duration: 300, closedBy: 'claims' });
    expect(next.rows[3]).toMatchObject({ duration: null, claims: 1 });
    expect(next.open).toBe(13);
  });

  test('more closes than a window replace the history with the newest window, no gap', async () => {
    const chain = held(
      Array.from({ length: 20 }, (_, i) => 90 + i),
      109,
    );
    const { chain: next } = await pollChain(fakeReader(200), chain);
    const epochs = next.rows.map((r) => r.epoch);
    expect(epochs[0]).toBe(200 - WINDOW + 1);
    expect(epochs.at(-1)).toBe(200);
    expect(epochs).toHaveLength(WINDOW);
    for (let i = 1; i < epochs.length; i++) expect(epochs[i]).toBe((epochs[i - 1] as number) + 1);
  });

  test('a history read that fails keeps the rows held and still publishes the fixed slots', async () => {
    const chain = held([10, 11, 12], 12);
    const { chain: next, historyError } = await pollChain(fakeReader(13, { failHistory: true }), chain);
    expect(historyError).toMatch(/503/);
    expect(next.rows).toBe(chain.rows);
    expect(next.open).toBe(13);
    expect(next.block.number).toBe(99);
  });
});

describe('readOlder', () => {
  test('joins the previous window in front and links across the seam', async () => {
    const chain = held([60, 61, 62], 62);
    const older = await readOlder(fakeReader(62), chain);
    expect(older.rows[0]?.epoch).toBe(60 - WINDOW);
    expect(older.rows.at(-1)?.epoch).toBe(62);
    expect(older.rows.find((r) => r.epoch === 59)).toMatchObject({ duration: 300, closedBy: 'claims' });
    expect(await readOlder(fakeReader(2), held([0, 1, 2], 2))).toEqual(held([0, 1, 2], 2));
  });
});
