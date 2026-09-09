import { TileBoundary } from '../../../ui/src/index.ts';
import { BalanceCard } from '../components/BalanceCard';
import type { MinerController } from '../controller';
import { LedgerTile } from '../features/LedgerTile';
import { KpiTiles, LoopTile } from '../features/LoopTile';
import { RailTile } from '../features/RailTile';
import { useTileLog } from '../lib/tile-log';

/**
 * The ledger and the balance tile share a wrapper so that between `md` and `xl` they stack beside the
 * rail; at `xl` it dissolves (`contents`) and the grid places them itself.
 */
export function Mine({ controller }: { controller: () => MinerController | undefined }) {
  const onError = useTileLog();
  return (
    <div
      className="grid items-start gap-[14px] md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_300px]"
      data-testid="cockpit"
    >
      <TileBoundary name="loop" onError={onError} className="md:col-span-2 xl:col-span-3">
        <LoopTile controller={controller} className="md:col-span-2 xl:col-span-3" />
      </TileBoundary>
      <TileBoundary name="rail" onError={onError} className="md:order-3 xl:order-none xl:row-span-2">
        <RailTile controller={controller} className="md:order-3 xl:order-none xl:row-span-2" />
      </TileBoundary>
      <TileBoundary name="kpis" onError={onError} className="md:col-span-2 xl:col-span-3">
        <KpiTiles className="md:col-span-2 xl:col-span-3" />
      </TileBoundary>
      <div className="contents md:order-4 md:flex md:flex-col md:gap-[14px] xl:contents">
        <TileBoundary name="ledger" onError={onError} className="xl:col-span-3">
          <LedgerTile className="xl:col-span-3" />
        </TileBoundary>
        <TileBoundary name="balance" onError={onError}>
          <BalanceCard />
        </TileBoundary>
      </div>
    </div>
  );
}
