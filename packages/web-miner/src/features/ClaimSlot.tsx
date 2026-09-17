// The rail's reserved slot for the claim: empty while mining, the stepper while a claim is in flight,
// the acknowledgement for ten seconds after a mint. It always occupies its height, so the loop beside
// it never moves. A claim's failure is on its ledger line and, for a lost race, the banner under the header.
import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { ExternalLink, Tile, TileHeader } from '../../../ui/src/index.ts';
import { links } from '../explorer';
import { amount } from '../lib/format';
import { type MinerState, type Minted, mintedFresh } from '../lib/reducer';
import { minerAtom, nowAtom } from '../state';
import { ClaimStepper, MintedMarks } from './ClaimStatus';

/** What the slot shows, by precedence: the claim in flight, a fresh mint, nothing. */
export const slotState = (m: MinerState, nowMs: number): 'claim' | 'minted' | 'idle' => {
  if (m.claim) return 'claim';
  if (mintedFresh(m.minted, nowMs)) return 'minted';
  return 'idle';
};

function Acknowledged({ minted }: { minted: Minted }) {
  return (
    <div className="flex flex-col gap-2">
      <p data-testid="minted" className="text-sm text-ok">
        ✓ {amount(PARAMS.REWARD, PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL} minted, privately ·{' '}
        <ExternalLink href={links.block(minted.block)} full={String(minted.block)}>
          block {minted.block.toLocaleString('en-US')}
        </ExternalLink>
      </p>
      <details className="text-xs text-ink-2" data-testid="minted-details">
        <summary className="cursor-pointer font-mono text-2xs tracking-[0.06em] text-ink-3 uppercase">
          Details
        </summary>
        <div className="mt-2">
          <MintedMarks minted={minted} />
        </div>
      </details>
    </div>
  );
}

export function ClaimSlot({ className }: { className?: string }) {
  const miner = useAtomValue(minerAtom);
  const now = useAtomValue(nowAtom);
  const state = slotState(miner, now);
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
  return (
    <Tile className={`min-h-[72px] border-uv ${className ?? ''}`} data-testid="claim-slot" data-state={state}>
      <TileHeader
        className="mb-2 text-uv-2"
        aside={
          state === 'claim' && miner.claim
            ? `won ${new Date(miner.claim.wonAt).toISOString().slice(11, 19)}`
            : undefined
        }
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
