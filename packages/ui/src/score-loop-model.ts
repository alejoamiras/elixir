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
