/**
 * One dot: a proof that finished at `t` (ms, performance.now() clock) with its score, the difficulty it
 * was scored against and that verdict. A retarget re-judges nothing; only a sample lacking them falls
 * back to the current bar.
 */
export interface Sample {
  t: number;
  score: number;
  bar?: number;
  win?: boolean;
  /** The epoch the proof was scored in, for the tick where the bar stepped. */
  epoch?: number;
  /** What a hover says of the proof: its number in the epoch, its proving time, its wall clock (ms). */
  n?: number;
  proveMs?: number;
  at?: number;
}

/**
 * A claim on the samples' clock, from the win to its end: open while `t1` is null. `id` is the win line it
 * annotates (null when the win came without one), which is how a later reconciliation finds it.
 */
export interface ClaimSpan {
  id: number | null;
  t0: number;
  t1: number | null;
  outcome?: 'minted' | 'failed';
}

const barOf = (s: Sample, difficulty: number | null): number | null => s.bar ?? difficulty;

/** The verdict recorded with the sample, else the score against its bar. */
export const won = (s: Sample, difficulty: number | null): boolean => {
  if (s.win !== undefined) return s.win;
  const bar = barOf(s, difficulty);
  return bar !== null && s.score >= bar;
};

export interface BarSegment {
  /** x fractions of the window (0 = span ago, 1 = now). */
  x0: number;
  x1: number;
  bar: number;
  /** The epoch of the first sample scored against this bar, when the sample carried one. */
  epoch?: number;
}

/**
 * The bar as a step through the window: each visible sample's bar holds up to that sample, the current
 * bar from the last sample to now, equal neighbours merged. The retarget's instant is unknown, so a change
 * is placed right after the last sample of the old bar. Samples must be oldest first.
 */
export function barSegments(
  samples: readonly Sample[],
  difficulty: number,
  now: number,
  spanMs: number,
): BarSegment[] {
  const out: BarSegment[] = [];
  let x0 = 0;
  const step = (x1: number, bar: number, epoch?: number) => {
    const last = out[out.length - 1];
    if (last && last.bar === bar) last.x1 = x1;
    else out.push({ x0, x1, bar, ...(epoch !== undefined && { epoch }) });
    x0 = x1;
  };
  for (const s of samples) {
    const age = (now - s.t) / spanMs;
    if (age > 1 || age < 0) continue;
    step(1 - age, s.bar ?? difficulty, s.epoch);
  }
  step(1, difficulty);
  return out;
}

export const LOG_MAX = 3; // the axis tops out at 1000
export const RISE_MS = 420;
export const FLASH_MS = 900;

/** Log axis 1–1000: 0 at the floor, 1 at the ceiling; clamped. */
export const axis = (score: number): number => Math.min(LOG_MAX, Math.max(0, Math.log10(score))) / LOG_MAX;

/**
 * The calm axis's ceiling: high enough that every bar in view sits low-middle and the best score in view
 * still fits, never below 2.5× the bar so an empty window still shows room above it.
 */
export const axisTop = (difficulty: number, samples: readonly Sample[]): number => {
  let best = 0;
  let bar = difficulty;
  for (const s of samples) {
    if (s.score > best) best = s.score;
    if (s.bar !== undefined && s.bar > bar) bar = s.bar;
  }
  return Math.max(2.5 * bar, 1.25 * best, 2);
};

/** Log axis 1–`top`: 0 at the floor, 1 at the ceiling; clamped. */
export const axisTo = (score: number, top: number): number =>
  Math.min(1, Math.max(0, Math.log(Math.max(1, score)) / Math.log(top)));

/** The baseline's label yields when the bar's line sits within a line of type of it. */
export const labelsCollide = (yBar: number, yBase: number, fontPx: number): boolean =>
  Math.abs(yBar - yBase) < 1.2 * fontPx;

/** The left margin a right-aligned axis label needs: its measured width plus the gap on both sides, never under the floor. */
export const marginFor = (labelWidth: number, floor: number, gap = 8): number =>
  Math.max(floor, Math.ceil(labelWidth) + 2 * gap);

/** The plot's x axis as one frame drew it: what a pointer is hit-tested against. */
export interface PlotGeometry {
  left: number;
  right: number;
  now: number;
  span: number;
}

/** The axis title is set vertically in the margin and needs its own column. */
export const TITLE_COLUMN = 14;

/**
 * `labelWidth` is the canvas's measured width of the widest axis label and `now` the frame's time: both come
 * in, so the function stays pure.
 */
export const plotGeometry = (g: {
  width: number;
  labelWidth: number;
  floor: number;
  now: number;
  spanMs: number;
  titled?: boolean;
}): PlotGeometry => ({
  left: marginFor(g.labelWidth, g.floor) + (g.titled ? TITLE_COLUMN : 0),
  right: g.width - 14,
  now: g.now,
  span: g.spanMs,
});

/** A time on the samples' clock to its pixel; outside [left, right] when outside the window. */
export const xAt = (g: PlotGeometry, t: number): number =>
  g.left + (1 - (g.now - t) / g.span) * (g.right - g.left);

const inWindow = (g: PlotGeometry, t: number): boolean => g.now - t <= g.span && g.now - t >= 0;

/** Calm: the ordinary proofs in view, oldest first. Drawn as one path, so ticks that overlap cannot add up. */
export const calmTicks = (
  samples: readonly Sample[],
  difficulty: number | null,
  g: PlotGeometry,
): { x: number; s: Sample }[] =>
  samples.filter((s) => inWindow(g, s.t) && !won(s, difficulty)).map((s) => ({ x: xAt(g, s.t), s }));

export interface SpanBox {
  x0: number;
  x1: number;
  /** The claim began inside the window: its left edge is the win, not the plot's. */
  opened: boolean;
  /** Still running: its right edge rides "now". */
  live: boolean;
  outcome?: ClaimSpan['outcome'];
  /** How long the claim has taken, or took. */
  ms: number;
}

/** The claims in view, clipped to the plot; one that ended before the window began is gone. */
export const spanBoxes = (spans: readonly ClaimSpan[], g: PlotGeometry): SpanBox[] =>
  spans.flatMap((c) => {
    const end = c.t1 ?? g.now;
    const x1 = Math.min(g.right, xAt(g, end));
    if (x1 <= g.left || c.t0 > g.now) return [];
    return [
      {
        x0: Math.max(g.left, xAt(g, c.t0)),
        x1,
        opened: xAt(g, c.t0) >= g.left,
        live: c.t1 === null,
        ...(c.outcome && { outcome: c.outcome }),
        ms: Math.max(0, end - c.t0),
      },
    ];
  });

/** The proof in view nearest to `x`, within `reach` pixels of it; null when none is. */
export function nearestSample(
  samples: readonly Sample[],
  g: PlotGeometry,
  x: number,
  reach = 10,
): Sample | null {
  let best: Sample | null = null;
  let distance = reach;
  for (const s of samples) {
    if (!inWindow(g, s.t)) continue;
    const d = Math.abs(xAt(g, s.t) - x);
    if (d <= distance) {
      best = s;
      distance = d;
    }
  }
  return best;
}

/** The proof one step older (-1) or newer (+1) than `from` among those in view; the newest when `from` is none of them. */
export function stepSample(
  samples: readonly Sample[],
  g: PlotGeometry,
  from: Sample | null,
  by: -1 | 1,
): Sample | null {
  const seen = samples.filter((s) => inWindow(g, s.t));
  const i = from === null ? -1 : seen.findIndex((s) => s.t === from.t);
  if (i < 0) return seen[seen.length - 1] ?? null;
  return seen[Math.min(seen.length - 1, Math.max(0, i + by))] ?? null;
}

export interface LabelBox {
  x0: number;
  x1: number;
  /** The text baseline. */
  y: number;
}

/**
 * The baseline for a label that must not sit on one already drawn: steps down a line at a time while it
 * overlaps one, stops at `floor` (the plot's baseline) and keeps the last place that fits, else the start.
 */
export function clearOf(placed: readonly LabelBox[], box: LabelBox, fontPx: number, floor: number): number {
  const overlaps = (y: number) =>
    placed.some((o) => o.x0 < box.x1 && box.x0 < o.x1 && Math.abs(o.y - y) < 1.2 * fontPx);
  let y = box.y;
  while (overlaps(y)) {
    const next = y + fontPx + 2;
    if (next > floor) return y;
    y = next;
  }
  return y;
}

/** Finite positive inputs: one decimal below 1e6, the compact exponent (3.4e38) above it. */
export const difficultyLabel = (d: number): string =>
  d >= 1e6 ? d.toExponential(1).replace('+', '') : d.toFixed(1);

/** Ease-out cubic rise of a fresh dot; 1 once it has settled (or under reduced motion). */
export const rise = (now: number, t: number, reduced = false): number => {
  if (reduced) return 1;
  const u = Math.min(1, Math.max(0, (now - t) / RISE_MS));
  return 1 - (1 - u) ** 3;
};

/** The bar's flash after a win, 1 → 0 over FLASH_MS. */
export const flash = (now: number, winAt: number | null): number =>
  winAt === null ? 0 : Math.max(0, 1 - (now - winAt) / FLASH_MS);

/** Keeps the last `spanMs` of attempts; samples must be pushed oldest-first on one clock. */
export class ScoreLoopModel {
  readonly samples: Sample[] = [];
  winAt: number | null = null;

  constructor(
    public difficulty: number,
    public readonly spanMs = 60_000,
  ) {}

  /** Recorded with its bar and verdict (defaulting to the bar in force now): a later retarget leaves both alone. */
  push(sample: Sample): void {
    const bar = sample.bar ?? this.difficulty;
    const win = sample.win ?? sample.score >= bar;
    this.samples.push({ ...sample, bar, win });
    if (win) this.winAt = sample.t;
    this.trim(sample.t);
  }

  trim(now: number): void {
    const cutoff = now - this.spanMs;
    let drop = 0;
    while (drop < this.samples.length && (this.samples[drop] as Sample).t < cutoff) drop++;
    if (drop) this.samples.splice(0, drop);
  }

  /** Dots visible at `now`, each with its x fraction (0 = span ago, 1 = now) and settled y fraction. */
  dots(now: number, reduced = false): { x: number; y: number; win: boolean; age: number }[] {
    return this.samples
      .filter((s) => now - s.t <= this.spanMs)
      .map((s) => ({
        x: 1 - (now - s.t) / this.spanMs,
        y: axis(s.score) * rise(now, s.t, reduced),
        win: won(s, this.difficulty),
        age: (now - s.t) / this.spanMs,
      }));
  }

  get last(): Sample | undefined {
    return this.samples[this.samples.length - 1];
  }
}
