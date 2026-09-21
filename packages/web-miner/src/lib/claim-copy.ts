// What a win line says after "a win": the claim's step while it runs, then one of the outcomes.

import { clockMinutes } from '@yacana/site/browser/format';
import type { ClaimStep, WinNote } from '@yacana/ui';
import { PROVING, type ProverKind } from '../presto';
import type { ClaimNote, ClaimProgress } from './reducer';

/** The chip's word for a step: the reducer's `waiting` is the user's "in a block". */
export const chipStep = (step: ClaimProgress['step']): ClaimStep =>
  step === 'waiting' ? 'in a block' : step;

const running = (c: ClaimNote, nowMs: number, prover: ProverKind): string => {
  if (c.step === 'sent') {
    const left = c.expiresAt === undefined ? null : c.expiresAt - nowMs / 1000;
    return left === null || left <= 0
      ? 'claiming: sent to the node'
      : `claiming: sent to the node · drops in ${clockMinutes(left)} if no block takes it`;
  }
  if (c.step === 'waiting') return 'claiming: in a block · syncing the note';
  return PROVING[prover].claim;
};

const ended = (c: ClaimNote): string => {
  switch (c.outcome) {
    case 'reverted':
      return `didn't land: ${
        c.stale
          ? 'the epoch closed first'
          : c.reason === undefined
            ? 'it reverted'
            : `it reverted (${c.reason})`
      } · the sponsor paid, your proof is unspent · re-syncing, about a minute`;
    case 'refused':
      return "didn't go out: the epoch closed before it was sent · nothing paid · mining continues";
    case 'expired':
      return `dropped: no block took it in ${c.ttlMinutes ?? 10} min · nothing paid · mining continues`;
    case 'delivery-blocked':
      return c.waitMinutes === undefined
        ? "didn't land: an earlier reverted claim blocks this account · re-syncing, about a minute"
        : `didn't land: an earlier reverted claim blocks this account · claims wait for Ethereum's finality, about ${c.waitMinutes} min`;
    case 'other':
      return `claim failed: ${c.reason ?? 'unknown'} · mining paused`;
    default:
      return 'not claimed: the epoch closed before the claim went out';
  }
};

/** The note for the ledger; none once the claim minted (the ✓ line under it says so). `prover` is who proves the claim under way. */
export function winNote(
  c: ClaimNote | undefined,
  nowMs: number,
  prover: ProverKind = 'wasm',
): WinNote | undefined {
  if (!c || c.outcome === 'minted') return undefined;
  if (c.outcome === undefined) return c.step ? { text: running(c, nowMs, prover), tone: 'uv' } : undefined;
  if (c.outcome === 'discarded') return { text: ended(c), tone: 'dim' };
  return { text: ended(c), tone: 'warn', ...(c.retry && { action: 'Retry' }) };
}

/** A minted line's settlement, after the block: final once its epoch is proven, or pruned with it. */
export const settlementSuffix = (
  settled: 'pending' | 'settled' | 'pruned' | undefined,
): string | undefined =>
  settled === 'settled' ? 'final' : settled === 'pruned' ? 'pruned: its epoch was never proven' : undefined;
