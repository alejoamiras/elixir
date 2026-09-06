// The four charts of the observatory, one per closing fact: emission against the schedule,
// difficulty (log), duration (amber where the escape hatch closed it), the retarget ratio.
import { difficulty } from '../../../miner-core/src/metrics.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import type { EpochRules } from '../../../miner-core/src/retarget.ts';
import { closedRows, Frame, H, halo, PAD, scales, ticks } from './frame.tsx';

/** The charts show the selection (the strip and the table make it); no chart takes a click. */
export interface ChartProps {
  rows: readonly EpochRow[];
  selected: number | null;
  rules: EpochRules & { REWARD: bigint; DECIMALS: number; TOKEN_SYMBOL: string };
}

const bars = (
  p: ChartProps,
  rows: EpochRow[],
  value: (r: EpochRow) => number,
  cls: (r: EpochRow) => string,
  atLeast = 1,
) => {
  const values = rows.map(value);
  const hi = Math.max(atLeast, ...values);
  const s = scales(rows.length, 0, hi);
  return {
    s,
    ticks: ticks(0, hi).map((t) => ({ value: t, y: s.y(t) })),
    nodes: rows.map((r, i) => (
      <g key={r.epoch}>
        {p.selected === r.epoch && halo(s, i)}
        <rect
          x={s.x(i) + 1}
          y={s.y(values[i] as number)}
          width={Math.max(1, s.band - 2)}
          height={H - PAD.b - s.y(values[i] as number)}
          className={cls(r)}
          data-epoch={r.epoch}
          data-slot="bar"
        />
      </g>
    )),
  };
};

/** Minted over the loaded epochs against N × REWARD per expected epoch, both from the first loaded row. */
export function Emission(p: ChartProps) {
  const rows = closedRows(p.rows);
  const unit = Number(p.rules.REWARD / 10n ** BigInt(p.rules.DECIMALS));
  let minted = 0;
  const cumulative = rows.map((r) => (minted += r.claims * unit));
  const start = rows[0]?.openedAt ?? 0;
  const schedule = rows.map(
    (r) =>
      ((r.openedAt + (r.duration ?? 0) - start) / Number(p.rules.EXPECTED_EPOCH_SECONDS)) * p.rules.N * unit,
  );
  const hi = Math.max(1, ...cumulative, ...schedule);
  const s = scales(rows.length, 0, hi);
  const path = (v: number[]) => v.map((y, i) => `${i ? 'L' : 'M'}${s.x(i) + s.band / 2},${s.y(y)}`).join(' ');
  return (
    <Frame
      title="emission"
      label={`emission: ${minted} ${p.rules.TOKEN_SYMBOL} minted over ${rows.length} closed epochs, against the schedule`}
      yTicks={ticks(0, hi).map((t) => ({ value: t, y: s.y(t) }))}
      tick={(v) => `${Math.round(v)}`}
      data-testid="chart-emission"
    >
      {rows.map((r, i) => p.selected === r.epoch && <g key={r.epoch}>{halo(s, i)}</g>)}
      <path d={path(schedule)} className="fill-none stroke-ink-3" strokeDasharray="4 3" strokeWidth={1} />
      <path d={path(cumulative)} className="fill-none stroke-uv" strokeWidth={2} data-slot="line" />
    </Frame>
  );
}

/** Difficulty per epoch on a log scale, the open epoch included. */
export function Difficulty(p: ChartProps) {
  const rows = [...p.rows];
  const values = rows.map((r) => difficulty(r.target));
  const lo = Math.min(...values, 1) / 2;
  const hi = Math.max(...values, 2) * 2;
  const s = scales(rows.length, lo, hi, true);
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${s.x(i) + s.band / 2},${s.y(v)}`).join(' ');
  return (
    <Frame
      title="difficulty per epoch, log scale"
      label={`difficulty: ${values.at(-1)?.toFixed(1)} now, ${rows.length} epochs shown`}
      yTicks={ticks(lo, hi, true).map((t) => ({ value: t, y: s.y(t) }))}
      tick={(v) => (v >= 1 ? `${v}` : v.toFixed(1))}
      data-testid="chart-difficulty"
    >
      {rows.map((r, i) => p.selected === r.epoch && <g key={r.epoch}>{halo(s, i)}</g>)}
      <path d={d} className="fill-none stroke-uv" strokeWidth={1.5} data-slot="line" />
      {rows.map((r, i) => (
        <circle
          key={r.epoch}
          cx={s.x(i) + s.band / 2}
          cy={s.y(values[i] as number)}
          r={2.5}
          className="fill-uv"
          data-slot="point"
        />
      ))}
    </Frame>
  );
}

/** Epoch durations; the ones the escape hatch closed are amber. */
export function Duration(p: ChartProps) {
  const rows = closedRows(p.rows);
  const expected = Number(p.rules.EXPECTED_EPOCH_SECONDS);
  const b = bars(
    p,
    rows,
    (r) => r.duration ?? 0,
    (r) => (r.closedBy === 'roll' ? 'fill-warn' : 'fill-uv/70'),
    expected,
  );
  return (
    <Frame
      title="epoch duration · amber = closed by the escape hatch"
      label={`duration of ${rows.length} closed epochs against ${expected} s expected`}
      yTicks={b.ticks}
      tick={(v) => `${Math.round(v)} s`}
      data-testid="chart-duration"
    >
      {b.nodes}
      <line
        x1={PAD.l}
        x2={PAD.l + b.s.band * rows.length}
        y1={b.s.y(expected)}
        y2={b.s.y(expected)}
        className="stroke-ink-2"
        strokeDasharray="4 3"
      />
    </Frame>
  );
}

/** target[e+1] / target[e]: below 1 the next epoch got harder (violet), above 1 easier (grey). */
export function Retarget(p: ChartProps) {
  const rows = closedRows(p.rows);
  const b = bars(
    p,
    rows,
    (r) => r.retarget ?? 1,
    (r) => ((r.retarget ?? 1) < 1 ? 'fill-uv' : 'fill-ink-3'),
  );
  return (
    <Frame
      title="retarget at each close · violet harder · grey easier"
      label={`retarget ratios of ${rows.length} closed epochs`}
      yTicks={b.ticks}
      tick={(v) => `×${v}`}
      data-testid="chart-retarget"
    >
      {b.nodes}
      <line
        x1={PAD.l}
        x2={PAD.l + b.s.band * rows.length}
        y1={b.s.y(1)}
        y2={b.s.y(1)}
        className="stroke-ink-2"
      />
    </Frame>
  );
}
