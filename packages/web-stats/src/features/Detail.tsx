import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty, sentence } from '../../../miner-core/src/metrics.ts';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { amount, duration } from '../../../site/src/browser/format.ts';
import { Badge, KvRow, Tile, TileHeader } from '../../../ui/src/index.ts';

const RULES = { N: PARAMS.N, EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS, T_MAX: PARAMS.T_MAX };
const clock = (unix: number) => new Date(unix * 1000).toISOString().slice(11, 19);

export function Detail({ row, next, now }: { row: EpochRow; next?: EpochRow; now: number }) {
  const closed = row.duration !== null;
  const closedAt = closed ? row.openedAt + (row.duration as number) : null;
  return (
    <Tile data-testid="detail">
      <TileHeader
        aside={
          <Badge
            variant={row.closedBy === 'roll' ? 'warn' : closed ? 'neutral' : 'uv'}
            data-testid="detail-closed-by"
          >
            {row.closedBy === 'roll'
              ? 'closed by roll()'
              : closed
                ? `closed by the ${PARAMS.N}th claim`
                : 'open'}
          </Badge>
        }
      >
        epoch {row.epoch}
      </TileHeader>
      <div className="grid gap-x-6 md:grid-cols-2">
        <KvRow label="opened" value={clock(row.openedAt)} />
        <KvRow
          label={closed ? 'closed' : 'open for'}
          value={closedAt ? clock(closedAt) : duration(Math.max(0, now - row.openedAt))}
        />
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
        {sentence(row, RULES)}
      </p>
    </Tile>
  );
}
