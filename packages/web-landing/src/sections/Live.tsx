import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty, networkRate, rateSample } from '../../../miner-core/src/metrics.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { amount, duration } from '../../../site/src/browser/format.ts';
import { difficultyLabel, Kpi } from '../../../ui/src/index.ts';
import { copy } from '../copy';
import type { Live as LiveRead } from '../live';
import { appHref, type LiveStatus } from '../state';
import { Section } from './Section';

/** 44 px tall at whatever width the column has; the stroke keeps its width under the stretch. */
function Sparkline({ rows }: { rows: EpochRow[] }) {
  const w = 240;
  const h = 44;
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
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="h-11 w-full text-uv"
      role="img"
      aria-label="difficulty per epoch"
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const mintedSub = (status: LiveStatus, unit: number): string => {
  if (status.phase === 'ready') return `${amount(status.live.supply / PARAMS.REWARD, 0)} claims × ${unit}`;
  return status.phase === 'unlaunched' ? copy.live.unlaunched : copy.live.loading;
};

/** On the chain's clock (the last block's time), not the visitor's: the two can disagree by minutes. */
const epochSub = (open: EpochRow, blockTime: number): string =>
  `open ${duration(Math.max(0, blockTime - open.openedAt))} · expected ${duration(Number(PARAMS.EXPECTED_EPOCH_SECONDS))}`;

/** `retarget` is the target's ratio at the close; the difficulty moved by its inverse. */
const difficultySub = (rows: EpochRow[]): string => {
  const closed = rows[rows.length - 2];
  return closed?.retarget ? `×${(1 / closed.retarget).toFixed(2)} at the last close` : copy.live.noHistory;
};

function Notices({ status, live }: { status: LiveStatus; live: LiveRead | undefined }) {
  return (
    <>
      {live?.historyError && (
        <span className="text-2xs text-warn" data-testid="live-history-error">
          history unavailable: {live.historyError}
        </span>
      )}
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
    </>
  );
}

export function Live({ status }: { status: LiveStatus }) {
  const live = status.phase === 'ready' ? status.live : undefined;
  const rows = live?.rows ?? [];
  const open = rows[rows.length - 1];
  const rate = networkRate(rows, PARAMS.N);
  const eligible = rateSample(rows).length;
  const unit = Number(PARAMS.REWARD / 10n ** BigInt(PARAMS.DECIMALS));
  return (
    // Every sub is two lines tall from md, so the row's end alignment lines the numbers up.
    <Section
      id="live"
      className="grid gap-4 px-4 py-7 md:grid-cols-[repeat(4,1fr)_1.4fr] md:items-end md:px-9 md:[&_[data-slot=kpi]>span:last-child]:min-h-[2lh]"
    >
      <Kpi
        size="lg"
        label="minted"
        value={<span data-testid="live-minted">{live ? amount(live.supply, PARAMS.DECIMALS, 0) : '—'}</span>}
        unit={PARAMS.TOKEN_SYMBOL}
        sub={mintedSub(status, unit)}
      />
      <Kpi
        size="lg"
        label="epoch"
        value={<span data-testid="live-open">{live ? live.open : '—'}</span>}
        unit={
          open && (
            <span data-testid="live-epoch">
              {open.claims} of {PARAMS.N}
            </span>
          )
        }
        sub={open && live ? epochSub(open, live.block.timestamp) : ''}
      />
      <Kpi
        size="lg"
        label="difficulty"
        value={
          <span data-testid="live-difficulty">{open ? difficultyLabel(difficulty(open.target)) : '—'}</span>
        }
        sub={open ? difficultySub(rows) : ''}
      />
      <Kpi
        size="lg"
        label="network"
        value={<span data-testid="live-network">{rate === null ? '—' : `≈ ${rate.toFixed(2)}`}</span>}
        unit="proofs/s"
        sub={rate === null ? copy.live.noHistory : `median of ${eligible} epochs closed by claims`}
      />
      <div className="flex min-w-0 flex-col gap-1.5">
        {rows.length > 1 ? <Sparkline rows={rows} /> : <div className="h-11" aria-hidden />}
        <a href={appHref('stats')} className="text-xs text-ink-3 hover:text-ink">
          {copy.live.sub}
        </a>
        <Notices status={status} live={live} />
      </div>
    </Section>
  );
}
