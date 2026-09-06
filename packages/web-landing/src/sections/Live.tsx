import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty, networkRate } from '../../../miner-core/src/metrics.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { amount } from '../../../site/src/browser/format.ts';
import { Kpi } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import { appHref, type LiveStatus } from '../state';
import { Section } from './Section';

function Sparkline({ rows }: { rows: EpochRow[] }) {
  const w = 240;
  const h = 48;
  const ys = rows.map((r) => Math.log10(Math.max(1, difficulty(r.target))));
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || 1;
  const points = ys
    .map(
      (y, i) =>
        `${((i / Math.max(1, ys.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 2 - ((y - lo) / span) * (h - 4)).toFixed(1)}`,
    )
    .join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-12 w-60 text-uv" role="img" aria-label="difficulty per epoch">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

const mintedSub = (status: LiveStatus, unit: number): string => {
  if (status.phase === 'ready') return `${amount(status.live.supply / PARAMS.REWARD, 0)} claims × ${unit}`;
  return status.phase === 'unlaunched' ? copy.live.unlaunched : copy.live.loading;
};

export function Live({ status }: { status: LiveStatus }) {
  const live = status.phase === 'ready' ? status.live : undefined;
  const rows = live?.rows ?? [];
  const open = rows[rows.length - 1];
  const rate = networkRate(rows, PARAMS.N);
  // The median ignores epochs closed by roll(): count the ones it used.
  const eligible = Math.min(6, rows.filter((r) => r.closedBy === 'claims').length);
  const unit = Number(PARAMS.REWARD / 10n ** BigInt(PARAMS.DECIMALS));
  return (
    <Section id="live" eyebrow="live" heading={copy.live.heading}>
      <div className="grid gap-4 md:grid-cols-4" data-testid="live-strip">
        <Kpi
          label="minted"
          value={
            <span data-testid="live-minted">{live ? amount(live.supply, PARAMS.DECIMALS, 0) : '—'}</span>
          }
          unit={PARAMS.TOKEN_SYMBOL}
          size="lg"
          sub={mintedSub(status, unit)}
        />
        <Kpi
          label={`epoch ${live?.open ?? '—'}`}
          value={<span data-testid="live-epoch">{open ? `${open.claims} of ${PARAMS.N}` : '—'}</span>}
          unit="claims"
          size="lg"
        />
        <Kpi
          label="difficulty"
          value={<span data-testid="live-difficulty">{open ? difficulty(open.target).toFixed(1) : '—'}</span>}
          size="lg"
        />
        <Kpi
          label="network"
          value={<span data-testid="live-network">{rate === null ? '—' : `≈ ${rate.toFixed(2)}`}</span>}
          unit="proofs/s"
          size="lg"
          sub={rate === null ? copy.live.noHistory : `median of the last ${eligible} epochs closed by claims`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        {rows.length > 1 && <Sparkline rows={rows} />}
        <a href={appHref('stats')} className="text-sm text-ink-2 underline underline-offset-4 hover:text-ink">
          {copy.live.sub}
        </a>
        {status.phase === 'ready' && status.unreachable && (
          <span className="text-2xs text-warn" data-testid="live-unreachable">
            {copy.live.unreachable}
          </span>
        )}
        {status.phase === 'error' && (
          <span className="text-2xs text-bad" data-testid="live-error">
            {status.message}
          </span>
        )}
      </div>
    </Section>
  );
}
