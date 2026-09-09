// The map fills in the background, one 48-epoch page per poll interval, newest first, until epoch
// 0 is held. It is the page's optional work: it runs behind the poll and behind any window the
// visitor asked for, and it stops for the visit the moment the node throttles or goes silent —
// the fill must never be what raises the banner. The cache carries what was read to the next visit.
import type { EpochRow } from '../../miner-core/src/reader.ts';
import type { History } from './state';
import { WINDOW } from './window';

export type FillStop = 'complete' | 'throttled' | 'silent' | 'failed';

export interface FillState {
  phase: 'idle' | 'filling' | 'stopped';
  reason?: FillStop;
  /** The oldest epoch of the run held down from the open one; null before beat two. */
  readTo: number | null;
}

export const IDLE: FillState = { phase: 'idle', readTo: null };

export interface FillDeps {
  /** A page read, `[from, to]` inclusive. */
  rows: (from: number, to: number, open: number) => Promise<EpochRow[]>;
  held: () => { open: number; history: History } | null;
  publish: (h: History) => void;
  transport: () => 'ok' | 'throttled' | 'silent';
  /** True while a window fetch is queued or running: the fill yields its turn. */
  foreground: () => boolean;
  /** The page's serial queue: the poll, the window fetches and the fill never overlap. */
  serial: (fn: () => Promise<void>) => Promise<void>;
  persist: (h: History, open: number) => void;
  onState: (s: FillState) => void;
}

/** The oldest epoch of the contiguous run held from the newest held epoch at or below `open`. */
export function readTo(rows: ReadonlyMap<number, EpochRow>, open: number): number | null {
  let top = -1;
  for (const e of rows.keys()) if (e <= open && e > top) top = e;
  if (top < 0) return null;
  let e = top;
  while (e > 0 && rows.has(e - 1)) e--;
  return e;
}

export function createFill(deps: FillDeps): { tick: () => Promise<void>; state: () => FillState } {
  let state = IDLE;
  const set = (next: FillState) => {
    state = next;
    deps.onState(next);
  };
  const stop = (reason: FillStop, at: number | null) => set({ phase: 'stopped', reason, readTo: at });

  /** Under what is held now: a poll may have landed since the tick. */
  const join = (rows: EpochRow[]): void => {
    const latest = deps.held();
    if (!latest) return;
    const next = new Map(latest.history.rows);
    for (const r of rows) next.set(r.epoch, r);
    const h = { ...latest.history, rows: next };
    deps.publish(h);
    deps.persist(h, latest.open);
    const at = readTo(next, latest.open);
    if (at === 0) stop('complete', 0);
    else set({ phase: 'filling', readTo: at });
  };

  /** One page: the WINDOW epochs under the run's oldest. The rules are checked again here: the queue may have held it. */
  const page = async (): Promise<void> => {
    const cur = deps.held();
    if (!cur || deps.foreground() || state.phase === 'stopped') return;
    const lo = readTo(cur.history.rows, cur.open);
    if (lo === null) return;
    if (lo === 0) return stop('complete', 0);
    const t = deps.transport();
    if (t !== 'ok') return stop(t, lo);
    try {
      join(await deps.rows(Math.max(0, lo - WINDOW), lo - 1, cur.open));
    } catch {
      const t = deps.transport();
      stop(t === 'ok' ? 'failed' : t, lo);
    }
  };

  const tick = async (): Promise<void> => {
    if (state.phase === 'stopped') return;
    const cur = deps.held();
    if (!cur) return;
    const lo = readTo(cur.history.rows, cur.open);
    if (lo === null) return;
    if (lo === 0) return stop('complete', 0);
    if (deps.foreground()) return;
    const t = deps.transport();
    if (t !== 'ok') return stop(t, lo);
    set({ phase: 'filling', readTo: lo });
    await deps.serial(page);
  };

  return { tick, state: () => state };
}
