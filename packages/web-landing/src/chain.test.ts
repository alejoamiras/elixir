import { describe, expect, test } from 'vitest';
import { type ChainSink, type Reads, readAll } from './chain';
import type { Launch, Live, Reader } from './live';

const reader = {} as Reader;
const launch: Launch = { genesis: { target: 1n, seed: 0n, launchAt: 0 }, lottery: { mix: 0n, reveals: 0 } };
const live = { rows: [], open: 0 } as unknown as Live;

describe('readAll', () => {
  test('launch mode reads the lottery on its own; the live read waits for launch()', async () => {
    const seen: string[] = [];
    const sink: ChainSink = {
      live: (s) => seen.push(`live:${typeof s === 'function' ? 'update' : s.phase}`),
      launch: (s) => seen.push(`launch:${s.phase}`),
    };
    const reads: Reads = {
      live: async () => {
        seen.push('readLive');
        return live;
      },
      launch: async () => launch,
      launched: async () => false,
    };
    await readAll(reader, sink, true, reads);
    expect(seen).toEqual(['launch:ready', 'live:unlaunched']);
    seen.length = 0;
    await readAll(reader, sink, true, { ...reads, launched: async () => true });
    expect(seen).toEqual(['launch:ready', 'readLive', 'live:ready']);
    seen.length = 0;
    await readAll(reader, sink, false, reads);
    expect(seen).toEqual(['readLive', 'live:ready']);
  });
});
