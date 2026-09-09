/** One dot: a proof that finished at `t` (ms, performance.now() clock) with its score. */
export interface Sample {
  t: number;
  score: number;
}

export const LOG_MAX = 3; // the axis tops out at 1000
export const RISE_MS = 420;
export const FLASH_MS = 900;

/** Log axis 1–1000: 0 at the floor, 1 at the ceiling; clamped. */
export const axis = (score: number): number => Math.min(LOG_MAX, Math.max(0, Math.log10(score))) / LOG_MAX;

/**
 * The calm axis's ceiling: high enough that the bar sits low-middle and the best score in view still fits,
 * never below 2.5× the bar so an empty window still shows room above it.
 */
export const axisTop = (difficulty: number, samples: readonly Sample[]): number => {
  let best = 0;
  for (const s of samples) if (s.score > best) best = s.score;
  return Math.max(2.5 * difficulty, 1.25 * best, 2);
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

  push(sample: Sample): void {
    this.samples.push(sample);
    if (sample.score >= this.difficulty) this.winAt = sample.t;
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
        win: s.score >= this.difficulty,
        age: (now - s.t) / this.spanMs,
      }));
  }

  get last(): Sample | undefined {
    return this.samples[this.samples.length - 1];
  }
}
