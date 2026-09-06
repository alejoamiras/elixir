// The epoch table as CSV, both ways. Cells that a spreadsheet would evaluate (a leading =, +, -,
// @, tab or CR) are prefixed with an apostrophe on the way out and stripped of it on the way in.
import type { EpochRow } from './reader.ts';

const COLUMNS = ['epoch', 'openedAt', 'claims', 'duration', 'retarget', 'closedBy', 'target'] as const;

const guard = (cell: string): string => (/^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell);
const unguard = (cell: string): string => (cell.startsWith("'") ? cell.slice(1) : cell);
const quote = (cell: string): string => (/[",\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell);

const cells = (r: EpochRow): string[] => [
  String(r.epoch),
  String(r.openedAt),
  String(r.claims),
  r.duration === null ? '' : String(r.duration),
  r.retarget === null ? '' : String(r.retarget),
  r.closedBy ?? '',
  `0x${r.target.toString(16)}`,
];

export const toCsv = (rows: readonly EpochRow[]): string =>
  [COLUMNS.join(','), ...rows.map((r) => cells(r).map(guard).map(quote).join(','))].join('\n');

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i] as string;
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      out.push(cell);
      cell = '';
    } else cell += c;
  }
  out.push(cell);
  return out;
}

export function fromCsv(text: string): EpochRow[] {
  const [header, ...lines] = text.split('\n').filter((l) => l.length);
  if (header !== COLUMNS.join(',')) throw new Error('not an epoch table');
  return lines.map((line) => {
    const [epoch, openedAt, claims, duration, retarget, closedBy, target] = splitLine(line).map(unguard);
    if (closedBy !== '' && closedBy !== 'claims' && closedBy !== 'roll')
      throw new Error(`bad closedBy: ${closedBy}`);
    return {
      epoch: Number(epoch),
      openedAt: Number(openedAt),
      claims: Number(claims),
      duration: duration ? Number(duration) : null,
      retarget: retarget ? Number(retarget) : null,
      closedBy: closedBy === '' ? null : closedBy,
      target: BigInt(target ?? '0x0'),
    };
  });
}
