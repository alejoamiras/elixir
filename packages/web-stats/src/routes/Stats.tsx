import { useAtomValue } from 'jotai';
import { useCallback } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Tile,
  TileBoundary,
  TileHeader,
} from '../../../ui/src/index.ts';
import { ChartRows } from '../features/ChartRows';
import { Detail } from '../features/Detail';
import { NotHere } from '../features/NotHere';
import { Observatory } from '../features/Observatory';
import { Strip } from '../features/Strip';
import { Table } from '../features/Table';
import { VerifyTile } from '../features/VerifyTile';
import { select, useSelected } from '../routes';
import { fixedAtom, historyAtom, loadingOlderAtom, nowAtom, rowsAtom } from '../state';

const RULES = {
  N: PARAMS.N,
  EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS,
  T_MAX: PARAMS.T_MAX,
  REWARD: PARAMS.REWARD,
  DECIMALS: PARAMS.DECIMALS,
  TOKEN_SYMBOL: PARAMS.TOKEN_SYMBOL,
};

/**
 * The A frame: six columns from `md`, the binder's spans from `xl`; one column on a phone. Every
 * tile is on the page from the first paint and fills at its beat (the fixed slots, then the window).
 */
export function Stats({ onOlder, nodeUrl }: { onOlder: () => void; nodeUrl: string }) {
  const fixed = useAtomValue(fixedAtom);
  const history = useAtomValue(historyAtom);
  const rows = useAtomValue(rowsAtom);
  const loadingOlder = useAtomValue(loadingOlderAtom);
  const now = useAtomValue(nowAtom);
  const selected = useSelected();
  const onSelect = useCallback((epoch: number | null) => select(epoch), []);
  const open = fixed?.open ?? null;
  const nowSec = Math.max(fixed?.block.timestamp ?? 0, Math.floor(now / 1000));
  // A `?epoch=` that is not loaded (older than the window, or a typo) follows the open epoch.
  const loaded = rows?.find((r) => r.epoch === selected);
  const current = loaded ?? rows?.[rows.length - 1] ?? null;
  const effective = loaded ? selected : null;
  const next = current && rows ? rows.find((r) => r.epoch === current.epoch + 1) : undefined;
  const oldestHeld = rows?.[0]?.epoch;
  return (
    <div className="grid gap-[14px] md:grid-cols-6" data-testid="stats">
      <TileBoundary name="observatory" className="md:col-span-6">
        <Observatory fixed={fixed} rows={rows} now={now} />
      </TileBoundary>
      {history?.error && (
        <Alert variant="warn" className="md:col-span-6" data-testid="history-limit">
          <AlertTitle>
            history unavailable{oldestHeld !== undefined ? ` beyond epoch ${oldestHeld}` : ''}
          </AlertTitle>
          <AlertDescription>{history.error}</AlertDescription>
        </Alert>
      )}
      <Tile className="md:col-span-6 xl:col-span-4">
        <TileHeader aside="width = duration · violet harder · grey easier · amber escape hatch">
          epochs since launch
        </TileHeader>
        <TileBoundary name="strip">
          <Strip
            rows={rows}
            open={open}
            selected={effective}
            onSelect={onSelect}
            now={nowSec}
            onOlder={onOlder}
          />
        </TileBoundary>
      </Tile>
      <TileBoundary name="detail" className="md:col-span-6 xl:col-span-2">
        <Detail
          className="md:col-span-6 xl:col-span-2"
          row={current}
          open={current !== null && current.epoch === open}
          next={next}
          now={nowSec}
        />
      </TileBoundary>
      <ChartRows rows={rows} selected={current?.epoch ?? null} rules={RULES} open={open} />
      <TileBoundary name="table" className="md:col-span-6">
        <Table
          className="md:col-span-6"
          rows={rows}
          open={open}
          selected={effective}
          onSelect={onSelect}
          onOlder={onOlder}
          loadingOlder={loadingOlder}
        />
      </TileBoundary>
      <TileBoundary name="not-here" className="md:col-span-3">
        <NotHere className="md:col-span-3" />
      </TileBoundary>
      <TileBoundary name="verify" className="md:col-span-3">
        <VerifyTile className="md:col-span-3" nodeUrl={nodeUrl} />
      </TileBoundary>
    </div>
  );
}
