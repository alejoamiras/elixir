import { useAtomValue } from 'jotai';
import { useCallback } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Alert, AlertDescription, AlertTitle, Tile, TileHeader } from '../../../ui/src/index.ts';
import { ChartRows } from '../features/ChartRows';
import { Detail } from '../features/Detail';
import { NotHere } from '../features/NotHere';
import { Observatory } from '../features/Observatory';
import { Strip } from '../features/Strip';
import { Table } from '../features/Table';
import { VerifyTile } from '../features/VerifyTile';
import { select, useSelected } from '../routes';
import { chainAtom, historyLimitAtom, loadingOlderAtom, nowAtom } from '../state';

const RULES = {
  N: PARAMS.N,
  EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS,
  T_MAX: PARAMS.T_MAX,
  REWARD: PARAMS.REWARD,
  DECIMALS: PARAMS.DECIMALS,
  TOKEN_SYMBOL: PARAMS.TOKEN_SYMBOL,
};

/** The A frame: six columns from `md`, the binder's spans from `xl`; one column on a phone. */
export function Stats({ onOlder, nodeUrl }: { onOlder: () => void; nodeUrl: string }) {
  const chain = useAtomValue(chainAtom);
  const limit = useAtomValue(historyLimitAtom);
  const loadingOlder = useAtomValue(loadingOlderAtom);
  const now = useAtomValue(nowAtom);
  const selected = useSelected();
  const onSelect = useCallback((epoch: number | null) => select(epoch), []);
  if (!chain) return null;
  const rows = chain.rows;
  const nowSec = Math.max(chain.block.timestamp, Math.floor(now / 1000));
  // A `?epoch=` that is not loaded (older than the window, or a typo) follows the open epoch.
  const loaded = rows.find((r) => r.epoch === selected);
  const current = loaded ?? rows[rows.length - 1];
  const effective = loaded ? selected : null;
  const next = current ? rows.find((r) => r.epoch === current.epoch + 1) : undefined;
  const charts = { rows, selected: current?.epoch ?? null, rules: RULES, open: chain.open };
  return (
    <div className="grid gap-[14px] md:grid-cols-6" data-testid="stats">
      <Observatory chain={chain} now={now} />
      {limit && (
        <Alert variant="warn" className="md:col-span-6" data-testid="history-limit">
          <AlertTitle>history unavailable beyond epoch {limit.beyond}</AlertTitle>
          <AlertDescription>{limit.reason}</AlertDescription>
        </Alert>
      )}
      {current && (
        <>
          <Tile className="md:col-span-6 xl:col-span-4">
            <TileHeader aside="width = duration · violet harder · grey easier · amber escape hatch">
              epochs since launch
            </TileHeader>
            <Strip
              rows={rows}
              open={chain.open}
              selected={effective}
              onSelect={onSelect}
              now={nowSec}
              onOlder={onOlder}
            />
          </Tile>
          <Detail
            className="md:col-span-6 xl:col-span-2"
            row={current}
            open={current.epoch === chain.open}
            next={next}
            now={nowSec}
          />
          <ChartRows {...charts} />
          <Table
            className="md:col-span-6"
            rows={rows}
            open={chain.open}
            selected={effective}
            onSelect={onSelect}
            onOlder={onOlder}
            loadingOlder={loadingOlder}
          />
        </>
      )}
      <NotHere className="md:col-span-3" />
      <VerifyTile className="md:col-span-3" nodeUrl={nodeUrl} />
    </div>
  );
}
