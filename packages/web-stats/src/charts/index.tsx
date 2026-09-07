// The four charts of the observatory, one per closing fact: emission against the schedule,
// difficulty (log), duration (amber where the escape hatch closed it), the retarget ratio.
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { Chart } from './plot';
import { type ChartRules, difficultyChart, duration, emission, retarget } from './specs';

/** The charts show the selection (the strip and the table make it); no chart takes a click. */
export interface ChartProps {
  rows: readonly EpochRow[];
  selected: number | null;
  rules: ChartRules;
}

const closed = (rows: readonly EpochRow[]) => rows.filter((r) => r.duration !== null).length;

export function Emission(p: ChartProps) {
  return (
    <Chart
      spec={emission}
      input={p}
      role="figure"
      aria-label={`emission: ${p.rules.TOKEN_SYMBOL} minted over ${closed(p.rows)} closed epochs from epoch ${p.rows[0]?.epoch ?? 0}, against the schedule`}
      data-testid="chart-emission"
    />
  );
}

export function Difficulty(p: ChartProps) {
  return (
    <Chart
      spec={difficultyChart}
      input={p}
      role="figure"
      aria-label={`difficulty per epoch, ${p.rows.length} epochs shown`}
      data-testid="chart-difficulty"
    />
  );
}

export function Duration(p: ChartProps) {
  return (
    <Chart
      spec={duration}
      input={p}
      role="figure"
      aria-label={`duration of ${closed(p.rows)} closed epochs against ${p.rules.EXPECTED_EPOCH_SECONDS} s expected`}
      data-testid="chart-duration"
    />
  );
}

export function Retarget(p: ChartProps) {
  return (
    <Chart
      spec={retarget}
      input={p}
      role="figure"
      aria-label={`retarget ratios of ${closed(p.rows)} closed epochs`}
      data-testid="chart-retarget"
    />
  );
}
