import type { Status } from '../../../ui/src/index.ts';
import type { MinerState } from './reducer';

/** One pill for the whole page: a page-side pause reads as paused, a fresh mint as minted. */
export const pillStatus = (m: MinerState): Status => {
  if (m.proverDead || m.phase === 'recovering' || m.notice?.kind === 'offline' || m.notice?.kind === 'paused')
    return 'paused';
  if (m.phase === 'idle' && m.minted) return 'minted';
  return m.phase;
};
