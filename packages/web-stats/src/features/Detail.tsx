import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty, sentence } from '../../../miner-core/src/metrics.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { amount, duration } from '../../../site/src/browser/format.ts';
import { Badge, KvRow, Tile, TileHeader } from '../../../ui/src/index.ts';

const RULES = { N: PARAMS.N, EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS, T_MAX: PARAMS.T_MAX };
const clock = (unix: number) => new Date(unix * 1000).toISOString().slice(11, 19);

type State = 'roll' | 'claims' | 'open' | 'unread';

/** How the row ended: by roll, by the Nth claim, not yet (the open epoch), or closed but unread. */
const stateOf = (row: EpochRow, open: boolean): State =>
  row.closedBy === 'roll' ? 'roll' : row.duration !== null ? 'claims' : open ? 'open' : 'unread';

const BADGE: Record<State, { variant: 'warn' | 'neutral' | 'uv'; text: string }> = {
  roll: { variant: 'warn', text: 'closed by roll()' },
  claims: { variant: 'neutral', text: `closed by the ${PARAMS.N}th claim` },
  open: { variant: 'uv', text: 'open' },
  unread: { variant: 'neutral', text: 'closed · not read yet' },
};

export function Detail({
  row,
  open,
  next,
  now,
}: {
  row: EpochRow;
  /** Whether `row` is the chain's open epoch; without closing facts otherwise it is closed, unread. */
  open: boolean;
  next?: EpochRow;
  now: number;
}) {
  const state = stateOf(row, open);
  const closed = row.duration !== null;
  const closedAt = closed ? row.openedAt + (row.duration as number) : null;
  const openFor = state === 'open' ? duration(Math.max(0, now - row.openedAt)) : '—';
  return (
    <Tile data-testid="detail">
      <TileHeader
        aside={
          <Badge variant={BADGE[state].variant} data-testid="detail-closed-by">
            {BADGE[state].text}
          </Badge>
        }
      >
        epoch {row.epoch}
      </TileHeader>
      <div className="grid gap-x-6 md:grid-cols-2">
        <KvRow label="opened" value={clock(row.openedAt)} />
        <KvRow label={closed ? 'closed' : 'open for'} value={closedAt ? clock(closedAt) : openFor} />
        <KvRow label="claims" value={`${row.claims} of ${PARAMS.N}`} />
        <KvRow label="duration" value={closed ? duration(row.duration as number) : '—'} />
        <KvRow
          label="difficulty"
          value={
            next
              ? `${difficulty(row.target).toFixed(1)} → ${difficulty(next.target).toFixed(1)}`
              : difficulty(row.target).toFixed(1)
          }
        />
        <KvRow
          label="minted"
          value={`${amount(BigInt(row.claims) * PARAMS.REWARD, PARAMS.DECIMALS, 0)} ${PARAMS.TOKEN_SYMBOL}`}
        />
      </div>
      <p className="mt-3 text-pretty text-sm text-ink" data-testid="sentence">
        {state === 'unread'
          ? 'Closed since; its duration and retarget have not been read yet.'
          : sentence(row, RULES)}
      </p>
    </Tile>
  );
}
