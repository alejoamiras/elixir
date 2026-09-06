import { useAtomValue } from 'jotai';
import { useCallback } from 'react';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { Alert, AlertDescription, AlertTitle } from '../../../ui/src/index.ts';
import { Difficulty, Duration, Emission, Retarget } from '../charts/index.tsx';
import { Detail } from '../features/Detail';
import { NotHere } from '../features/NotHere';
import { Observatory } from '../features/Observatory';
import { Strip } from '../features/Strip';
import { Table } from '../features/Table';
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

export function Stats({ onOlder }: { onOlder: () => void }) {
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
  const charts = { rows, selected: current?.epoch ?? null, rules: RULES };
  return (
    <div className="flex flex-col gap-4">
      <Observatory chain={chain} now={now} />
      {limit && (
        <Alert variant="warn" data-testid="history-limit">
          <AlertTitle>history unavailable beyond epoch {limit.beyond}</AlertTitle>
          <AlertDescription>{limit.reason}</AlertDescription>
        </Alert>
      )}
      {rows.length > 0 && (
        <>
          <div className="rounded-md border border-line bg-panel p-4">
            <p className="eyebrow mb-3">
              epochs since launch · width = duration · violet harder · grey easier · amber escape hatch
            </p>
            <Strip
              rows={rows}
              open={chain.open}
              selected={effective}
              onSelect={onSelect}
              now={nowSec}
              onOlder={onOlder}
            />
          </div>
          {current && <Detail row={current} open={current.epoch === chain.open} next={next} now={nowSec} />}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-md border border-line bg-panel p-4">
              <Emission {...charts} />
            </div>
            <div className="rounded-md border border-line bg-panel p-4">
              <Difficulty {...charts} />
            </div>
            <div className="rounded-md border border-line bg-panel p-4">
              <Duration {...charts} />
            </div>
            <div className="rounded-md border border-line bg-panel p-4">
              <Retarget {...charts} />
            </div>
          </div>
          <Table
            rows={rows}
            open={chain.open}
            selected={effective}
            onSelect={onSelect}
            onOlder={onOlder}
            loadingOlder={loadingOlder}
          />
        </>
      )}
      <NotHere />
    </div>
  );
}
