import { atom } from 'jotai';
import { type EpochRow, linkRows } from '../../miner-core/src/reader.ts';

export interface Genesis {
  target: bigint;
  seed: bigint;
  launchAt: number;
}
export interface Lottery {
  mix: bigint;
  reveals: number;
}

/** Beat one: the open epoch's number, the latest block, the supply and the genesis, read together. */
export interface Fixed {
  open: number;
  /** The node's latest block and its slot time (unix s). */
  block: { number: number; timestamp: number };
  supply: bigint;
  genesis: Genesis;
  /** Wall clock (ms) of the read that produced this. */
  readAt: number;
}

/** Beat two: the epoch rows held, by epoch, and the lottery; `error` when the window read failed (the rows kept). */
export interface History {
  rows: Map<number, EpochRow>;
  lottery: Lottery | null;
  error?: string;
}

export type Status =
  | { phase: 'loading'; step: string }
  | { phase: 'ready' }
  /** The node stopped answering; the last chain view stays on screen. */
  | { phase: 'unreachable'; since: number; error: string }
  | { phase: 'error'; message: string };

export const fixedAtom = atom<Fixed | null>(null);
export const historyAtom = atom<History | null>(null);
/** The rows held, ascending and linked (the open epoch last when held); null until beat two lands. */
export const rowsAtom = atom<EpochRow[] | null>((get) => {
  const h = get(historyAtom);
  if (!h) return null;
  return linkRows([...h.rows.values()].sort((a, b) => a.epoch - b.epoch));
});
/** 300 ms since mount: a beat still unresolved shows its skeleton; before that, the bare geometry. */
export const slowAtom = atom(false);
export const statusAtom = atom<Status>({ phase: 'loading', step: 'connecting' });
export const loadingOlderAtom = atom(false);
export const nowAtom = atom(Date.now());
/** The supply at this tab's first successful read and when it happened; a reload starts over. */
export const sinceOpenedAtom = atom<{ supply: bigint; at: number } | null>(null);
/** Display numbers still gliding to their value, by id; the visual gate waits for the set to empty. */
export const unsettledAtom = atom<ReadonlySet<string>>(new Set<string>());
