import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useMemo } from 'react';
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
import { select, setFrom, useFrom, useSelected } from '../routes';
import { fillAtom, fixedAtom, type History, historyAtom, nowAtom, rowsAtom } from '../state';
import { type EpochWindow, windowFor, windowHeld, windowRowsOf } from '../window';

const RULES = {
  N: PARAMS.N,
  EXPECTED_EPOCH_SECONDS: PARAMS.EXPECTED_EPOCH_SECONDS,
  T_MAX: PARAMS.T_MAX,
  REWARD: PARAMS.REWARD,
  DECIMALS: PARAMS.DECIMALS,
  TOKEN_SYMBOL: PARAMS.TOKEN_SYMBOL,
};

const NONE: readonly never[] = [];

/** What the window shows: whether it is held, its rows, and the newest window's rows (the observatory's). */
function frame(history: History | null, win: EpochWindow | null, open: number | null) {
  if (!history || !win || open === null) return { held: false, rows: null, newest: null };
  const held = windowHeld(history.rows, win);
  return {
    held,
    rows: held ? windowRowsOf(history.rows, win) : null,
    newest: windowRowsOf(history.rows, windowFor(null, open)),
  };
}

/**
 * The A frame: six columns from `md`, the binder's spans from `xl`; one column on a phone. Every
 * tile is on the page from the first paint and fills at its beat (the fixed slots, then the window).
 * The strip, the charts and the table show the window `?from=` names; the observatory reads the
 * newest one whatever the window; a window not held is asked for through `onWindow`.
 */
export function Stats({ onWindow, nodeUrl }: { onWindow: (w: EpochWindow) => void; nodeUrl: string }) {
  const fixed = useAtomValue(fixedAtom);
  const history = useAtomValue(historyAtom);
  const all = useAtomValue(rowsAtom) ?? NONE;
  const fill = useAtomValue(fillAtom);
  const now = useAtomValue(nowAtom);
  const selected = useSelected();
  const from = useFrom();
  const onSelect = useCallback((epoch: number | null) => select(epoch), []);
  const onFrom = useCallback((f: number | null) => setFrom(f), []);
  const open = fixed?.open ?? null;
  // One object per window, so the fetch effect fires on a window change, not on every tick.
  const win = useMemo(() => (open === null ? null : windowFor(from, open)), [from, open]);
  const { held, rows, newest } = frame(history, win, open);
  useEffect(() => {
    if (win && history && !held) onWindow(win);
  }, [history, held, onWindow, win]);
  const nowSec = Math.max(fixed?.block.timestamp ?? 0, Math.floor(now / 1000));
  // The card shows the epoch the URL names when it is held anywhere; otherwise the window's newest row.
  const named = selected === null ? undefined : all.find((r) => r.epoch === selected);
  const current = named ?? rows?.[rows.length - 1] ?? null;
  const effective = named ? selected : null;
  const next = current ? all.find((r) => r.epoch === current.epoch + 1) : undefined;
  return (
    <div className="grid gap-[14px] md:grid-cols-6" data-testid="stats">
      <TileBoundary name="observatory" className="md:col-span-6">
        <Observatory fixed={fixed} rows={newest} now={now} />
      </TileBoundary>
      {history?.error && (
        <Alert variant="warn" className="md:col-span-6" data-testid="history-limit">
          <AlertTitle>history unavailable</AlertTitle>
          <AlertDescription>{history.error}</AlertDescription>
        </Alert>
      )}
      <Tile className="md:col-span-6 xl:col-span-4">
        <TileHeader aside="width = duration · violet harder · grey easier · amber the escape hatch">
          epochs since launch
        </TileHeader>
        <TileBoundary name="strip">
          <Strip
            rows={rows}
            all={all}
            open={open}
            window={win}
            selected={effective}
            onSelect={onSelect}
            now={nowSec}
            launchAt={fixed?.genesis.launchAt ?? null}
            onWindow={onFrom}
            fill={fill}
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
        <Table className="md:col-span-6" rows={rows} open={open} selected={effective} onSelect={onSelect} />
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
