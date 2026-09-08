import { atom } from 'jotai';
import type { PreflightRow } from '../../ui/src/index.ts';
import type { MasterRecord } from './keys/store';
import type { EpochInfo, MinerState } from './lib/reducer';
import { initial } from './lib/reducer';
import type { OpeningStep } from './opening-steps';
import type { CrsProgress } from './pinned-crs';

export type Boot =
  /** Isolation, CRS, node, deployment: each row with its evidence. */
  | { phase: 'preflight'; rows: PreflightRow[] }
  /** Preflight passed, no account open: the chain shows, the key screen decides how to open. */
  | { phase: 'signedOut'; records: MasterRecord[]; error?: string }
  /** An account is opening; the steps drive the dialog's bar. `key` done means the ceremony is over. */
  | { phase: 'opening'; steps: OpeningStep[] }
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
/** The proving keys' download, from page load; the wallet's and the prover's start wait for `done`. */
export const crsAtom = atom<CrsProgress>({ loaded: 0, total: 0, done: false });
/** The sign-in dialog is wanted while no account is open: "Not now" clears it, the cockpit's buttons set it. */
export const signInAtom = atom(true);
export const nowAtom = atom(Date.now());
