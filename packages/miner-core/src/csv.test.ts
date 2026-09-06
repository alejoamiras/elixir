import { describe, expect, test } from 'bun:test';
import { fromCsv, toCsv } from './csv.ts';
import type { EpochRow } from './reader.ts';

const rows: EpochRow[] = [
  {
    epoch: 0,
    target: 1n << 124n,
    openedAt: 1_700_000_000,
    claims: 4,
    duration: 288,
    retarget: 0.96,
    closedBy: 'claims',
  },
  {
    epoch: 1,
    target: (1n << 124n) - 1n,
    openedAt: 1_700_000_288,
    claims: 2,
    duration: 1296,
    retarget: 4,
    closedBy: 'roll',
  },
  {
    epoch: 2,
    target: 1n << 126n,
    openedAt: 1_700_001_584,
    claims: 1,
    duration: null,
    retarget: null,
    closedBy: null,
  },
];

describe('csv', () => {
  test('round-trips the epoch table, bigints and nulls included', () => {
    const text = toCsv(rows);
    expect(text.split('\n')[0]).toBe('epoch,openedAt,claims,duration,retarget,closedBy,target');
    expect(text.split('\n')[3]).toBe('2,1700001584,1,,,,0x40000000000000000000000000000000');
    expect(fromCsv(text)).toEqual(rows);
    expect(() => fromCsv('a,b\n1,2')).toThrow(/not an epoch table/);
    expect(() => fromCsv(`${text.split('\n')[0]}\n0,0,0,,,nope,0x1`)).toThrow(/closedBy/);
  });

  test('a cell a spreadsheet would evaluate is neutralised on the way out and restored on the way in', () => {
    // No real row starts a cell with a formula character; the guard exists for the day one does.
    const text = toCsv([{ ...(rows[2] as EpochRow), closedBy: '=1+1' as unknown as null }]);
    expect(text.split('\n')[1]).toContain(",'=1+1,");
    const back = fromCsv(text.replace(",'=1+1,", ',,'));
    expect(back[0]?.closedBy).toBeNull();
    expect(() => fromCsv(text)).toThrow(/closedBy/);
  });
});
