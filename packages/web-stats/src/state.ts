import { atom } from 'jotai';
import type { EpochRow } from '../../miner-core/src/reader.ts';

export interface Chain {
  /** Epoch rows this page holds, ascending and contiguous, ending at the open epoch. */
  rows: EpochRow[];
  open: number;
  supply: bigint;
  genesis: { target: bigint; seed: bigint; launchAt: number };
  lottery: { mix: bigint; reveals: number };
  /** The node's latest block and its slot time (unix s). */
  block: { number: number; timestamp: number };
  /** Wall clock (ms) of the read that produced this. */
  readAt: number;
}

export type Status =
  | { phase: 'loading'; step: string }
  | { phase: 'ready' }
  /** The node stopped answering; the last chain view stays on screen. */
  | { phase: 'unreachable'; since: number; error: string }
  | { phase: 'error'; message: string };

export const chainAtom = atom<Chain | null>(null);
export const statusAtom = atom<Status>({ phase: 'loading', step: 'connecting' });
/** Epochs the slot table could not serve (a chunk failed to load): the history stops there. */
export const historyLimitAtom = atom<{ beyond: number; reason: string } | null>(null);
export const loadingOlderAtom = atom(false);
export const nowAtom = atom(Date.now());
/** The supply at this tab's first successful read and when it happened; a reload starts over. */
export const sinceOpenedAtom = atom<{ supply: bigint; at: number } | null>(null);
/** Display numbers still gliding to their value, by id; the visual gate waits for the set to empty. */
export const unsettledAtom = atom<ReadonlySet<string>>(new Set<string>());
