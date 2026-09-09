import { describe, expect, test } from 'vitest';
import type { EpochRow } from '../../miner-core/src/reader.ts';
import { linkRows } from '../../miner-core/src/reader.ts';
import { barHeight, barsFor, cellW, cellX, dayTicks, epochAtX, thinTicks, windowBox } from './map-geometry';

const DAY = 86_400;
/** Epoch `e` opened `e × 300` s after `launch`; the target halves at 10, the escape hatch closes 20. */
const row = (e: number, launch: number): EpochRow => ({
  epoch: e,
  target: e < 10 ? 1n << 122n : 1n << 121n,
  openedAt: launch + e * 300,
  claims: e === 20 ? 2 : 4,
  duration: null,
  retarget: null,
  closedBy: null,
});
const rows = (n: number, launch = 0) => linkRows(Array.from({ length: n }, (_, e) => row(e, launch)));

describe('the map', () => {
  test('a bar sits at its absolute cell; a page arriving adds bars and moves none', () => {
    const open = 99;
    const all = barsFor(rows(100), open);
    expect(all).toHaveLength(100);
    expect(all[0]).toMatchObject({ epoch: 0, x: 0, w: cellW(open) });
    expect(all[99]?.x).toBeCloseTo(cellX(99, open), 12);
    const page = barsFor(rows(100).slice(52), open);
    for (const b of page) expect(b.x).toBe(all[b.epoch]?.x);
    expect(all[9]?.tone).toBe('harder');
    expect(all[10]?.tone).toBe('easier');
    expect(all[20]?.tone).toBe('roll');
    expect(all[99]?.tone).toBe('open');
  });

  test('heights: 3 px for the open one and short epochs, log10 × 4.6 between, 18 px from a day', () => {
    expect(barHeight(null)).toBe(3);
    expect(barHeight(4)).toBe(3);
    expect(barHeight(300)).toBeCloseTo(Math.log10(300) * 4.6, 6);
    expect(barHeight(DAY)).toBe(18);
    expect(barHeight(30 * DAY)).toBe(18);
  });

  test('the window box covers 48 cells, fewer only where the chain is shorter', () => {
    expect(windowBox(0, 0)).toEqual({ x: 0, w: 1 });
    expect(windowBox(0, 1)).toEqual({ x: 0, w: 1 });
    expect(windowBox(0, 47)).toEqual({ x: 0, w: 1 });
    expect(windowBox(1, 48)).toEqual({ x: 1 / 49, w: 48 / 49 });
    expect(windowBox(952, 999)).toEqual({ x: 952 / 1000, w: 48 / 1000 });
    expect(windowBox(0, 999).w).toBeCloseTo(0.048, 12);
  });

  test('the epoch under a fraction of the width', () => {
    expect(epochAtX(0, 999)).toBe(0);
    expect(epochAtX(0.5, 999)).toBe(500);
    expect(epochAtX(0.9999, 999)).toBe(999);
    expect(epochAtX(1.2, 999)).toBe(999);
    expect(epochAtX(-0.1, 999)).toBe(0);
  });

  test('day ticks: launch first, one per UTC day at the first held epoch after it, now last; gaps keep one', () => {
    const launch = 3 * DAY + 3600;
    const all = rows(600, launch); // 50 h of epochs → three day boundaries
    const ticks = dayTicks(all, launch, 599);
    expect(ticks[0]).toEqual({ x: 0, label: 'launch · 01-04' });
    expect(ticks[ticks.length - 1]).toEqual({ x: 1, label: 'now' });
    expect(ticks.slice(1, -1).map((t) => t.label)).toEqual(['01-05', '01-06']);
    const e = Math.ceil((DAY - 3600) / 300);
    expect(ticks[1]?.x).toBe(cellX(e, 599));
    // Only the newest 100 held: each boundary is labelled by the first held epoch of its own day.
    const partial = dayTicks(all.slice(500), launch, 599);
    expect(partial.map((t) => t.label)).toEqual(['launch · 01-04', '01-05', '01-06', 'now']);
    expect(partial[1]?.x).toBe(cellX(500, 599));
    // Nothing held on 01-05: no tick claims it.
    const later = dayTicks(all.slice(570), launch, 599);
    expect(later.map((t) => t.label)).toEqual(['launch · 01-04', '01-06', 'now']);
    expect(dayTicks([], launch, 599).map((t) => t.label)).toEqual(['launch · 01-04', 'now']);
  });

  test('thinning keeps the ends and only labels a label apart', () => {
    const ticks = Array.from({ length: 11 }, (_, i) => ({ x: i / 10, label: `t${i}` }));
    expect(thinTicks(ticks, 1000, 48).map((t) => t.label)).toEqual(ticks.map((t) => t.label));
    expect(thinTicks(ticks, 200, 48).map((t) => t.label)).toEqual(['t0', 't3', 't6', 't10']);
    expect(thinTicks(ticks, 60, 48).map((t) => t.label)).toEqual(['t0', 't10']);
  });
});
