// What the four charts share: the frame, the scales, the selection halo. Plain SVG, no library.
import type * as React from 'react';
import type { EpochRow } from '../../../miner-core/src/reader.ts';

export const W = 640;
export const H = 180;
export const PAD = { l: 44, r: 8, t: 10, b: 22 };

export interface Scale {
  x: (i: number) => number;
  y: (v: number) => number;
  band: number;
}

/** Epoch index → x band; `y` maps `[lo, hi]` (log when asked) onto the plot height. */
export function scales(count: number, lo: number, hi: number, log = false): Scale {
  const width = W - PAD.l - PAD.r;
  const height = H - PAD.t - PAD.b;
  const band = width / Math.max(1, count);
  const f = log ? Math.log10 : (v: number) => v;
  const [a, b] = [f(lo), f(hi)];
  const span = b - a || 1;
  return {
    x: (i) => PAD.l + i * band,
    y: (v) => PAD.t + height - ((f(v) - a) / span) * height,
    band,
  };
}

/** Tick values: 2 to 4 round numbers inside `[lo, hi]`. */
export function ticks(lo: number, hi: number, log = false): number[] {
  if (log) {
    const out: number[] = [];
    for (let p = Math.floor(Math.log10(Math.max(lo, 1e-9))); 10 ** p <= hi; p++) out.push(10 ** p);
    return out.filter((t) => t >= lo);
  }
  const step = 10 ** Math.floor(Math.log10(Math.max(hi - lo, 1e-9)));
  const out: number[] = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(t);
  return out.length > 4 ? out.filter((_, i) => i % 2 === 0) : out;
}

export function Frame({
  title,
  label,
  children,
  yTicks,
  tick,
  ...rest
}: {
  title: string;
  label: string;
  children: React.ReactNode;
  yTicks: { value: number; y: number }[];
  /** Renders a tick's value. */
  tick: (v: number) => string;
} & Omit<React.SVGProps<SVGSVGElement>, 'children'>) {
  return (
    <figure className="m-0" data-slot="chart">
      <figcaption className="eyebrow mb-2">{title}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="block h-auto w-full" {...rest}>
        {yTicks.map((t) => (
          <g key={t.value}>
            <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} className="stroke-line" strokeWidth={1} />
            <text x={PAD.l - 6} y={t.y + 3} textAnchor="end" className="fill-ink-3 font-mono text-[9px]">
              {tick(t.value)}
            </text>
          </g>
        ))}
        {children}
      </svg>
    </figure>
  );
}

/** The point of every chart: the epoch under the cursor or the selection. */
export const halo = (scale: Scale, i: number): React.ReactNode => (
  <rect
    x={scale.x(i)}
    y={PAD.t}
    width={scale.band}
    height={H - PAD.t - PAD.b}
    className="fill-uv/15"
    data-slot="halo"
  />
);

/** Emission, duration and retarget read the closed rows; the open one has no closing facts. */
export const closedRows = (rows: readonly EpochRow[]): EpochRow[] => rows.filter((r) => r.duration !== null);
