// The four charts as Plot specs: data, scales and marks, nothing about the DOM. Colours are the
// theme's variables (Chromium resolves var() in presentation attributes), so the light palette
// and a theme switch reach the marks without a redraw. Marks carry a `className` on their group
// and an `ariaLabel` per datum: the tests count real marks through them.
import * as Plot from '@observablehq/plot';
import { difficulty } from '../../../miner-core/src/metrics.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import type { EpochRules } from '../../../miner-core/src/retarget.ts';
import { difficultyLabel } from '../../../ui/src/index.ts';

export type ChartRules = EpochRules & { REWARD: bigint; DECIMALS: number; TOKEN_SYMBOL: string };

export interface ChartInput {
  rows: readonly EpochRow[];
  selected: number | null;
  rules: ChartRules;
  width: number;
  height: number;
}

export type Spec = (input: ChartInput) => Plot.PlotOptions;

/** The lead chart's height and the small multiples'. */
export const LEAD_HEIGHT = 200;
export const SMALL_HEIGHT = 110;
const LEFT = 52;
const RIGHT = 8;
const UV = 'var(--uv)';
const WARN = 'var(--warn)';
const INK2 = 'var(--ink-2)';
const INK3 = 'var(--ink-3)';
/** The duration axis starts here: an implicit zero baseline draws nothing on a log scale. */
const FLOOR = 10;

const base = (width: number, height: number, options: Plot.PlotOptions): Plot.PlotOptions => ({
  width,
  height,
  marginLeft: LEFT,
  marginRight: RIGHT,
  marginTop: 12,
  marginBottom: 22,
  style:
    'font-family: var(--font-mono); font-size: 10px; color: var(--ink-2); background: transparent; --plot-background: var(--panel)',
  ...options,
});

/** Emission, duration and retarget read the closed rows; the open one has no closing facts. */
const closedRows = (rows: readonly EpochRow[]): EpochRow[] => rows.filter((r) => r.duration !== null);

/** The selection as a translucent band over its epoch, on a band x scale. */
const haloBand = (rows: EpochRow[], selected: number | null, y1: number, y2: number) =>
  Plot.barY(
    rows.filter((r) => r.epoch === selected),
    {
      x: 'epoch',
      y1,
      y2,
      fill: UV,
      fillOpacity: 0.15,
      inset: 0,
      className: 'halo',
      ariaLabel: (r: EpochRow) => `selected epoch ${r.epoch}`,
    },
  );

const epochTick = (e: number) => (Number.isInteger(e) ? `${e}` : '');

interface RollLabel {
  r: EpochRow;
  anchor: 'start' | 'end';
  row: number;
  text: string;
}

const ratioLabel = (ratio: number) => `÷${Number.isInteger(ratio) ? ratio : ratio.toFixed(2)}`;

/** Where a label of width `w` at `x` may read: rightward, leftward past the right 30 % or the edge, or nowhere. */
const labelAnchor = (x: number, w: number, left: number, right: number): 'start' | 'end' | null => {
  const inward = x > left + 0.7 * (right - left);
  if (!inward && x + w <= right) return 'start';
  if (x - w >= left) return 'end';
  return x + w <= right ? 'start' : null;
};

/**
 * A roll's label at its close, placed by `labelAnchor`; two rows for neighbours, none when neither
 * row has room (the tip carries the annotation). Text is measured at the mono face's 6 px per glyph.
 */
const placeRollLabels = (rolls: EpochRow[], x0: number, x1: number, width: number): RollLabel[] => {
  const left = LEFT;
  const right = width - RIGHT;
  const px = (e: number) => left + ((e - x0) / Math.max(1, x1 - x0)) * (right - left);
  const taken: [number, number][][] = [[], []];
  const out: RollLabel[] = [];
  for (const r of rolls) {
    const ratio = ratioLabel(r.retarget as number);
    const text =
      width < 480 ? `${ratio} · epoch ${r.epoch}` : `escape hatch closed epoch ${r.epoch} · ${ratio}`;
    const w = text.length * 6 + 8;
    const x = px(r.epoch + 1);
    const anchor = labelAnchor(x, w, left, right);
    if (!anchor) continue;
    const span: [number, number] = anchor === 'start' ? [x, x + w] : [x - w, x];
    const row = taken.findIndex((spans) => spans.every(([a, b]) => span[1] <= a || span[0] >= b));
    if (row < 0) continue;
    taken[row]?.push(span);
    out.push({ r, anchor, row, text });
  }
  return out;
};

/** The four label marks of the lead chart, one per anchor and row: the rows sit 14 px apart, whatever the log domain spans. */
const rollLabelMarks = (placed: RollLabel[], y: number) =>
  (['start', 'end'] as const).flatMap((anchor) =>
    [0, 1].map((row) =>
      Plot.text(
        placed.filter((p) => p.anchor === anchor && p.row === row),
        {
          x: (p: RollLabel) => p.r.epoch + 1,
          y,
          text: (p: RollLabel) => p.text,
          fill: WARN,
          ...HALO,
          textAnchor: anchor,
          lineAnchor: 'top',
          dx: anchor === 'start' ? 4 : -4,
          dy: 2 + row * 14,
        },
      ),
    ),
  );

/** Every k-th epoch, the newest always among them, so the labels stay about 28 px apart. */
const epochTicks = (epochs: number[], width: number): number[] => {
  const room = Math.max(1, Math.floor((width - 60) / 28));
  const k = Math.max(1, Math.ceil(epochs.length / room));
  return epochs.filter((_, i) => (epochs.length - 1 - i) % k === 0);
};
/**
 * The lead chart's x ticks: every third epoch, the open one last as "N · open"; a numeric tick within
 * 60 px of the open one goes.
 */
const leadTicks = (epochs: number[], open: number, x0: number, x1: number, width: number): number[] => {
  const px = (e: number) => LEFT + ((e - x0) / Math.max(1, x1 - x0)) * (width - RIGHT - LEFT);
  return [...epochs.filter((e) => e !== open && e % 3 === 0 && px(open) - px(e) >= 60), open];
};
/** Tick labels stay readable over bars: the tile's background as a halo behind the glyphs. */
const HALO = { stroke: 'var(--raised)', strokeWidth: 3 } as const;
const wholeOrLabel = (v: number) => (v >= 1 && v < 1e6 && Number.isInteger(v) ? `${v}` : difficultyLabel(v));

/** Minted over elapsed time from the oldest loaded row, against N × REWARD per expected epoch. */
export const emission: Spec = ({ rows, selected, rules, width, height }) => {
  const closed = closedRows(rows);
  const unit = Number(rules.REWARD / 10n ** BigInt(rules.DECIMALS));
  const start = closed[0]?.openedAt ?? 0;
  const points: { epoch: number; hours: number; minted: number }[] = [];
  let minted = 0;
  for (const r of closed) {
    minted += r.claims * unit;
    points.push({ epoch: r.epoch, hours: (r.openedAt + (r.duration as number) - start) / 3600, minted });
  }
  type Point = (typeof points)[number];
  const perHour = (3600 / Number(rules.EXPECTED_EPOCH_SECONDS)) * rules.N * unit;
  const end = points[points.length - 1]?.hours ?? 0;
  const schedule = [
    { hours: 0, minted: 0 },
    { hours: end, minted: end * perHour },
  ];
  const at = (p: Point) => `+${p.hours.toFixed(1)} h`;
  return base(width, height, {
    x: { label: null, ticks: 4, tickFormat: (h: number) => `+${Math.round(h)} h` },
    y: {
      label: null,
      grid: true,
      ticks: 2,
      tickFormat: (v: number) => (v >= 1000 ? `${v / 1000}k` : `${v}`),
      domain: [0, Math.max(1, ...points.map((p) => p.minted), end * perHour)],
    },
    marks: [
      Plot.lineY(schedule, {
        x: 'hours',
        y: 'minted',
        stroke: INK3,
        strokeDasharray: '4 3',
        className: 'schedule',
      }),
      Plot.areaY(points, { x: 'hours', y: 'minted', curve: 'step-after', fill: UV, fillOpacity: 0.12 }),
      Plot.lineY(points, {
        x: 'hours',
        y: 'minted',
        curve: 'step-after',
        stroke: UV,
        strokeWidth: 1.5,
        className: 'minted',
      }),
      Plot.dot(points, {
        x: 'hours',
        y: 'minted',
        r: 2.5,
        fill: UV,
        className: 'point',
        ariaLabel: (p: Point) => `epoch ${p.epoch}: ${p.minted} ${rules.TOKEN_SYMBOL} by ${at(p)}`,
      }),
      Plot.dot(
        points.filter((p) => p.epoch === selected),
        { x: 'hours', y: 'minted', r: 7, fill: UV, fillOpacity: 0.25, className: 'halo' },
      ),
      Plot.tip(
        points,
        Plot.pointerX({
          x: 'hours',
          y: 'minted',
          title: (p: Point) =>
            `epoch ${p.epoch}\n${p.minted} ${rules.TOKEN_SYMBOL} minted\n${at(p)} after epoch ${closed[0]?.epoch ?? 0} opened`,
        }),
      ),
    ],
  });
};

/** Difficulty per epoch as a step line, the open epoch included, log base 2; a roll annotated at its close. */
export const difficultyChart: Spec = ({ rows, selected, width, height }) => {
  const steps = rows.map((r) => ({ epoch: r.epoch, d: difficulty(r.target), row: r }));
  type Step = (typeof steps)[number];
  const last = steps[steps.length - 1];
  // The open epoch's step spans its width: the line ends one epoch past the last point.
  const line = last ? [...steps, { ...last, epoch: last.epoch + 1 }] : [];
  const values = steps.map((s) => s.d);
  const lo = Math.min(...values, 1) / 2;
  const hi = Math.max(...values, 2) * 2;
  const rolls = rows.filter((r) => r.closedBy === 'roll' && r.retarget !== null);
  const mid = (s: Step) => s.epoch + 0.5;
  const placed = placeRollLabels(rolls, steps[0]?.epoch ?? 0, (last?.epoch ?? 0) + 1, width);
  const x0 = steps[0]?.epoch ?? 0;
  const open = last?.epoch ?? 0;
  const x1 = open + 1;
  return base(width, height, {
    x: {
      label: null,
      domain: [x0, x1],
      ticks: leadTicks(
        steps.map((s) => s.epoch),
        open,
        x0,
        x1,
        width,
      ),
      tickFormat: (e: number) => (e === open ? `${e} · open` : epochTick(e)),
    },
    y: {
      type: 'log',
      base: 2,
      label: null,
      grid: true,
      domain: [lo, hi],
      ticks: [1, 4, 16, 64, 256, 1024, 4096].filter((t) => t >= lo && t <= hi),
      tickFormat: wholeOrLabel,
    },
    marks: [
      Plot.rect(
        steps.filter((s) => s.epoch === selected),
        {
          x1: 'epoch',
          x2: (s: Step) => s.epoch + 1,
          y1: lo,
          y2: hi,
          fill: UV,
          fillOpacity: 0.15,
          className: 'halo',
        },
      ),
      Plot.lineY(line, {
        x: 'epoch',
        y: 'd',
        curve: 'step-after',
        stroke: UV,
        strokeWidth: 1.5,
        className: 'line',
      }),
      Plot.dot(steps, {
        x: mid,
        y: 'd',
        r: 2.5,
        fill: UV,
        className: 'point',
        ariaLabel: (s: Step) => `epoch ${s.epoch}: difficulty ${difficultyLabel(s.d)}`,
      }),
      Plot.ruleX(rolls, {
        x: (r: EpochRow) => r.epoch + 1,
        stroke: WARN,
        strokeDasharray: '3 3',
        className: 'roll',
      }),
      ...rollLabelMarks(placed, hi),
      Plot.crosshairX(steps, { x: mid, y: 'd' }),
      Plot.tip(
        steps,
        Plot.pointerX({
          x: mid,
          y: 'd',
          title: (s: Step) =>
            `epoch ${s.epoch}\ndifficulty ${difficultyLabel(s.d)}\n${s.row.claims} claims · ${s.row.duration === null ? 'open' : `${s.row.duration} s`}${s.row.closedBy === 'roll' ? `\nclosed through the escape hatch · ${ratioLabel(s.row.retarget as number)} at the close` : ''}`,
        }),
      ),
    ],
  });
};

/** Closed epochs' durations from a 10 s floor on a log scale; the escape hatch's closes amber; T_MAX a rule, never a cap. */
export const duration: Spec = ({ rows, selected, rules, width, height }) => {
  const closed = closedRows(rows);
  const expected = Number(rules.EXPECTED_EPOCH_SECONDS);
  const tMax = Number(rules.T_MAX);
  const hi = Math.max(tMax * 1.5, ...closed.map((r) => (r.duration as number) * 1.3));
  const drawn = closed.filter((r) => Number.isFinite(r.duration) && (r.duration as number) > FLOOR);
  const floored = closed.filter((r) => !drawn.includes(r));
  const label = (r: EpochRow) =>
    `epoch ${r.epoch}: ${r.duration} s${r.closedBy === 'roll' ? ', closed by the escape hatch' : ''}`;
  const bars = (data: EpochRow[], className: string, fill: string) =>
    Plot.barY(data, { x: 'epoch', y1: FLOOR, y2: 'duration', fill, className, ariaLabel: label });
  const rule = (at: number, text: string, stroke: string, anchor: 'left' | 'right', dash?: string) => [
    Plot.ruleY([at], { stroke, strokeDasharray: dash, className: 'rule' }),
    Plot.text([at], {
      y: (d: number) => d,
      text: () => text,
      fill: stroke,
      ...HALO,
      frameAnchor: anchor,
      dy: -7,
      dx: anchor === 'left' ? 4 : -4,
    }),
  ];
  const DAY = 86_400;
  const ticks = [10, 1000, DAY].filter((t) => t <= hi);
  return base(width, height, {
    x: {
      label: null,
      ticks: epochTicks(
        closed.map((r) => r.epoch),
        width,
      ),
      tickFormat: epochTick,
    },
    y: { type: 'log', label: null, grid: true, domain: [FLOOR, hi], ticks },
    marks: [
      // An explicit axis: on a log scale Plot hands even a function formatter to d3, which blanks a day's tick.
      Plot.axisY(ticks, { label: null, text: (v: number) => (v === DAY ? '1 d' : `${v} s`) }),
      haloBand(closed, selected, FLOOR, hi),
      bars(
        drawn.filter((r) => r.closedBy !== 'roll'),
        'claims',
        UV,
      ),
      bars(
        drawn.filter((r) => r.closedBy === 'roll'),
        'roll',
        WARN,
      ),
      Plot.dot(floored, {
        x: 'epoch',
        y: FLOOR,
        r: 3,
        fill: 'none',
        stroke: INK3,
        className: 'floored',
        ariaLabel: (r: EpochRow) => `epoch ${r.epoch}: ${r.duration} s, at or below the ${FLOOR} s floor`,
      }),
      ...rule(expected, `expected ${expected / 60} min`, INK2, 'right', '4 3'),
      ...rule(
        tMax,
        width < 420 ? `${tMax / 60} min` : `${tMax / 60} min · anyone may close it after this`,
        WARN,
        'left',
      ),
      Plot.tip(
        closed,
        Plot.pointerX({
          x: 'epoch',
          y: 'duration',
          title: (r: EpochRow) =>
            `epoch ${r.epoch}\n${r.duration} s · ${((r.duration as number) / expected).toFixed(2)}× expected${r.closedBy === 'roll' ? '\nclosed by the escape hatch' : ''}`,
        }),
      ),
    ],
  });
};

/** target[e+1] / target[e] from a baseline of 1, log base 2: below 1 the next epoch got harder (violet). */
export const retarget: Spec = ({ rows, selected, width, height }) => {
  const closed = closedRows(rows).filter((r) => r.retarget !== null);
  const ratio = (r: EpochRow) => r.retarget as number;
  // The contract clamps a retarget to [¼, 4]; anything else is a node lying or a wrong slot, marked, not drawn.
  const within = (r: EpochRow) => Number.isFinite(ratio(r)) && ratio(r) >= 0.25 && ratio(r) <= 4;
  const valid = closed.filter(within);
  const bars = (data: EpochRow[], className: string, fill: string) =>
    Plot.barY(data, {
      x: 'epoch',
      y1: 1,
      y2: 'retarget',
      fill,
      className,
      ariaLabel: (r: EpochRow) => `epoch ${r.epoch}: retarget ×${ratio(r).toFixed(2)}`,
    });
  return base(width, height, {
    x: {
      label: null,
      ticks: epochTicks(
        closed.map((r) => r.epoch),
        width,
      ),
      tickFormat: epochTick,
    },
    y: {
      type: 'log',
      base: 2,
      label: null,
      grid: true,
      domain: [0.25, 4],
      ticks: [0.25, 1, 4],
      tickFormat: (v: number) => `×${v}`,
    },
    marks: [
      haloBand(closed, selected, 0.25, 4),
      bars(
        valid.filter((r) => ratio(r) < 1),
        'harder',
        UV,
      ),
      bars(
        valid.filter((r) => ratio(r) >= 1),
        'easier',
        INK3,
      ),
      Plot.dot(
        closed.filter((r) => !within(r)),
        {
          x: 'epoch',
          y: 1,
          r: 3,
          fill: 'none',
          stroke: WARN,
          className: 'invalid',
          ariaLabel: (r: EpochRow) => `epoch ${r.epoch}: retarget ×${ratio(r)}, outside ¼…4`,
        },
      ),
      Plot.ruleY([1], { stroke: INK2, className: 'baseline' }),
      Plot.tip(
        closed,
        Plot.pointerX({
          x: 'epoch',
          y: 'retarget',
          title: (r: EpochRow) =>
            `epoch ${r.epoch}\ntarget ×${ratio(r).toFixed(2)} → difficulty ×${(1 / ratio(r)).toFixed(2)}`,
        }),
      ),
    ],
  });
};
