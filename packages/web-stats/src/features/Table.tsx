// Epochs newest first, and the two downloads: the CSV of what is shown, the JSON of the rows.
import { toCsv } from '../../../miner-core/src/csv.ts';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty } from '../../../miner-core/src/metrics.ts';
import { type EpochRow, rowsToJson } from '../../../miner-core/src/reader.ts';
import { Button, cn, Tile, TileHeader } from '../../../ui/src/index.ts';

const clock = (unix: number) => new Date(unix * 1000).toISOString().slice(11, 19);
const HEAD = [
  'epoch',
  'opened (UTC)',
  'claims',
  'duration',
  'vs expected',
  'difficulty',
  'closed by',
  'next',
];

/** A download the CSP allows: a blob URL on an anchor, revoked once clicked. */
export function download(name: string, text: string, type: string): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Row({
  r,
  selected,
  onSelect,
}: {
  r: EpochRow;
  selected: number | null;
  onSelect: (e: number | null) => void;
}) {
  const expected = Number(PARAMS.EXPECTED_EPOCH_SECONDS);
  const open = r.duration === null;
  const dur = r.duration ?? 0;
  return (
    <tr
      data-epoch={r.epoch}
      onClick={() => onSelect(open ? null : r.epoch)}
      className={cn(
        'cursor-pointer border-b border-line hover:bg-raised',
        r.epoch === selected && 'bg-uv-dim',
      )}
    >
      <td className="py-1.5 pr-4">{r.epoch}</td>
      <td className="py-1.5 pr-4 text-ink-2">{clock(r.openedAt)}</td>
      <td className="py-1.5 pr-4">{open ? `${r.claims} of ${PARAMS.N}` : r.claims}</td>
      <td className="py-1.5 pr-4">{open ? 'open' : `${dur} s`}</td>
      <td className="py-1.5 pr-4 text-ink-2">
        {open ? '–' : `${(dur / expected).toFixed(2)}×${dur > Number(PARAMS.T_MAX) ? ' · capped' : ''}`}
      </td>
      <td className="py-1.5 pr-4">{difficulty(r.target).toFixed(1)}</td>
      <td className="py-1.5 pr-4 text-ink-2">
        {r.closedBy === 'roll' ? 'roll()' : r.closedBy ? `${PARAMS.N}th claim` : '–'}
      </td>
      <td className="py-1.5 pr-4 text-ink-2">
        {r.retarget === null ? '–' : `×${(1 / r.retarget).toFixed(2)}`}
      </td>
    </tr>
  );
}

export function Table({
  rows,
  selected,
  onSelect,
  onOlder,
  loadingOlder,
}: {
  rows: readonly EpochRow[];
  selected: number | null;
  onSelect: (epoch: number | null) => void;
  onOlder: () => void;
  loadingOlder: boolean;
}) {
  const oldest = rows[0]?.epoch ?? 0;
  return (
    <Tile>
      <TileHeader
        aside={
          <span className="flex gap-2">
            <Button
              size="sm"
              onClick={() => download('yacana-epochs.csv', toCsv(rows), 'text/csv')}
              data-testid="download-csv"
            >
              CSV
            </Button>
            <Button
              size="sm"
              onClick={() => download('yacana-epochs.json', rowsToJson(rows), 'application/json')}
              data-testid="download-json"
            >
              JSON
            </Button>
          </span>
        }
      >
        epochs, newest first
      </TileHeader>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse font-mono text-xs" data-testid="table">
          <thead>
            <tr className="text-left text-ink-2">
              {HEAD.map((h) => (
                <th key={h} className="border-b border-line py-1.5 pr-4 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...rows].reverse().map((r) => (
              <Row key={r.epoch} r={r} selected={selected} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
      {oldest > 0 && (
        <Button
          size="sm"
          variant="link"
          className="mt-3 px-0"
          disabled={loadingOlder}
          onClick={onOlder}
          data-testid="load-older"
        >
          {loadingOlder ? 'loading…' : `load older (before epoch ${oldest})`}
        </Button>
      )}
    </Tile>
  );
}
