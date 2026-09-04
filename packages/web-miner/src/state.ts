import { atom } from 'jotai';
import type { EpochInfo, MinerState } from './lib/reducer';
import { initial } from './lib/reducer';

export type Boot =
  | { phase: 'booting'; step: string }
  | { phase: 'ready'; account: string; threads: number; created: boolean }
  | { phase: 'error'; message: string };

export interface Rules {
  N: number;
  EXPECTED_EPOCH_SECONDS: bigint;
  T_MAX: bigint;
  REWARD: bigint;
}

export const bootAtom = atom<Boot>({ phase: 'booting', step: 'starting' });
export const minerAtom = atom<MinerState>(initial);
export const epochAtom = atom<EpochInfo | null>(null);
export const rulesAtom = atom<Rules | null>(null);
export const balanceAtom = atom<bigint | null>(null);
export const claimsAtom = atom<{ epoch: bigint; block: number; at: number }[]>([]);
export const logAtom = atom<string[]>([]);
export const nowAtom = atom(Date.now());
