import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty, sentence } from '../../../miner-core/src/metrics.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { amount, clockMinutes, durationParts } from '../../../site/src/browser/format.ts';
import { Badge, difficultyLabel, Kpi, Tile, TileHeader } from '../../../ui/src/index.ts';

const RULES = { N: PARAMS.N, EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS, T_MAX: PARAMS.T_MAX };
const clock = (unix: number) => new Date(unix * 1000).toISOString().slice(11, 19);

type State = 'roll' | 'claims' | 'open' | 'unread';

/** How the row ended: by roll, by the Nth claim, not yet (the open epoch), or closed but unread. */
const stateOf = (row: EpochRow, open: boolean): State =>
  row.closedBy === 'roll' ? 'roll' : row.duration !== null ? 'claims' : open ? 'open' : 'unread';

const BADGE: Record<State, { variant: 'warn' | 'neutral' | 'uv'; text: string }> = {
  roll: { variant: 'warn', text: 'closed by the escape hatch' },
  claims: { variant: 'neutral', text: `closed by the ${PARAMS.N}th claim` },
  open: { variant: 'uv', text: 'open' },
  unread: { variant: 'neutral', text: 'closed · not read yet' },
};

export function Detail({
  row,
  open,
  next,
  now,
  className,
}: {
  row: EpochRow;
  /** Whether `row` is the chain's open epoch; without closing facts otherwise it is closed, unread. */
  open: boolean;
  next?: EpochRow;
  now: number;
  className?: string;
}) {
  const state = stateOf(row, open);
  const closedAt = row.duration === null ? null : row.openedAt + row.duration;
  const span = `${clock(row.openedAt)} → ${closedAt ? clock(closedAt) : state === 'open' ? 'open' : '…'}`;
  const [dur, durUnit] =
    row.duration !== null
      ? durationParts(row.duration)
      : state === 'open'
        ? [clockMinutes(now - row.openedAt), 'min · counting']
        : ['—', ''];
  return (
    <Tile className={className} data-testid="detail">
      <TileHeader aside={span}>epoch {row.epoch}</TileHeader>
      <div className="mb-2 flex flex-wrap gap-4">
        <Kpi
          label="claims"
          value={<span className={state === 'roll' ? 'text-warn' : undefined}>{row.claims}</span>}
          unit={`of ${PARAMS.N}`}
        />
        <Kpi
          label={row.duration === null ? 'open for' : 'duration'}
          value={<span data-testid={row.duration === null ? 'detail-open-for' : undefined}>{dur}</span>}
          unit={durUnit || undefined}
        />
        <Kpi
          label="difficulty"
          value={difficultyLabel(difficulty(row.target))}
          unit={next ? `→ ${difficultyLabel(difficulty(next.target))}` : undefined}
        />
      </div>
      <p className="text-pretty text-xs text-ink-3" data-testid="sentence">
        {state === 'unread'
          ? 'Closed since; its duration and retarget have not been read yet.'
          : sentence(row, RULES)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Badge variant={BADGE[state].variant} data-testid="detail-closed-by">
          {BADGE[state].text}
        </Badge>
        <Badge>
          {amount(BigInt(row.claims) * PARAMS.REWARD, PARAMS.DECIMALS, 0)} {PARAMS.TOKEN_SYMBOL} minted
        </Badge>
      </div>
    </Tile>
  );
}
