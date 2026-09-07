// The rail's reserved slot for the claim: empty while mining, the stepper while a claim is in flight, the
// acknowledgement for ten seconds after a mint, and the card when a claim failed. It always occupies its
// height, so the loop beside it never moves.
import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { ExternalLink, Tile, TileHeader } from '../../../ui/src/index.ts';
import { links } from '../explorer';
import { amount } from '../lib/format';
import { type MinerState, type Minted, mintedFresh, type Notice } from '../lib/reducer';
import { minerAtom, nowAtom } from '../state';
import { ClaimStepper, NoticeCard } from './ClaimStatus';

const CLAIM_NOTICES: Notice['kind'][] = ['reverted', 'expired', 'failed'];

/** What the slot shows, by precedence: a claim's failure, the claim in flight, a fresh mint, nothing. */
export const slotState = (m: MinerState, nowMs: number): 'notice' | 'claim' | 'minted' | 'idle' => {
  if (m.notice && CLAIM_NOTICES.includes(m.notice.kind)) return 'notice';
  if (m.claim) return 'claim';
  if (mintedFresh(m.minted, nowMs)) return 'minted';
  return 'idle';
};

function Acknowledged({ minted }: { minted: Minted }) {
  return (
    <p data-testid="minted" className="text-sm text-ok">
      ✓ {amount(PARAMS.REWARD, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL} minted, privately ·{' '}
      <ExternalLink href={links.block(minted.block)} full={String(minted.block)}>
        block {minted.block.toLocaleString('en-US')}
      </ExternalLink>
    </p>
  );
}

export function ClaimSlot({ className }: { className?: string }) {
  const miner = useAtomValue(minerAtom);
  const now = useAtomValue(nowAtom);
  const state = slotState(miner, now);
  // `since` moves at each step; the win's moment is the current step's start minus the finished steps.
  const wonAt = miner.claim ? miner.claim.since - miner.claim.done.reduce((a, b) => a + b, 0) : 0;
  const claimEpoch = miner.job?.epoch;
  if (state === 'idle')
    return (
      <Tile
        flat
        className={`min-h-[72px] border-dashed text-center ${className ?? ''}`}
        data-testid="claim-slot"
      >
        <TileHeader className="mb-1 justify-center">claim</TileHeader>
        <p className="text-xs text-ink-3">no claim in flight</p>
      </Tile>
    );
  if (state === 'notice' && miner.notice)
    return (
      <div className={`min-h-[72px] ${className ?? ''}`} data-testid="claim-slot" data-state="notice">
        <NoticeCard notice={miner.notice} recovering={miner.phase === 'recovering'} />
      </div>
    );
  return (
    <Tile className={`min-h-[72px] border-uv ${className ?? ''}`} data-testid="claim-slot" data-state={state}>
      <TileHeader
        className="mb-2 text-uv-2"
        aside={state === 'claim' ? `won ${new Date(wonAt).toISOString().slice(11, 19)}` : undefined}
      >
        {state === 'claim'
          ? `claim${claimEpoch === undefined ? '' : ` · epoch ${claimEpoch.toString()}`}`
          : 'minted'}
      </TileHeader>
      {state === 'claim' && miner.claim ? <ClaimStepper claim={miner.claim} /> : null}
      {state === 'minted' && miner.minted ? <Acknowledged minted={miner.minted} /> : null}
    </Tile>
  );
}
