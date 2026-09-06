import { atom } from 'jotai';
import type { PreflightRow } from '../../ui/src/index.ts';
import type { MasterRecord } from './keys/store';
import type { EpochInfo, MinerState } from './lib/reducer';
import { initial } from './lib/reducer';

export type Boot =
  /** Isolation, CRS, node, deployment: each row with its evidence. */
  | { phase: 'preflight'; rows: PreflightRow[] }
  /** Preflight passed; the key screen decides how to open. */
  | { phase: 'key'; records: MasterRecord[]; error?: string }
  /** The ceremony passed; wallet, account and prover are coming up. */
  | { phase: 'opening'; step: string }
  | { phase: 'ready'; account: string; threads: number; record: MasterRecord }
  | { phase: 'error'; message: string };

export interface Rules {
  N: number;
  EXPECTED_EPOCH_SECONDS: bigint;
  T_MAX: bigint;
  REWARD: bigint;
}

export const bootAtom = atom<Boot>({ phase: 'preflight', rows: [] });
export const minerAtom = atom<MinerState>(initial);
export const epochAtom = atom<EpochInfo | null>(null);
export const rulesAtom = atom<Rules | null>(null);
export const balanceAtom = atom<bigint | null>(null);
export const claimsAtom = atom<{ epoch: bigint; block: number; at: number }[]>([]);
export const logAtom = atom<string[]>([]);
export const nowAtom = atom(Date.now());
