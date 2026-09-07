import { WalletCard } from '../components/WalletCard';
import type { MinerController } from '../controller';
import { LedgerTile } from '../features/LedgerTile';
import { KpiTiles, LoopTile } from '../features/LoopTile';
import { RailTile } from '../features/RailTile';

/**
 * The ledger and the key tile share a wrapper so that between `md` and `xl` they stack beside the
 * rail; at `xl` it dissolves (`contents`) and the grid places them itself.
 */
export function Mine({ controller }: { controller: () => MinerController | undefined }) {
  return (
    <div
      className="grid items-start gap-[14px] md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_300px]"
      data-testid="cockpit"
    >
      <LoopTile controller={controller} className="md:col-span-2 xl:col-span-3" />
      <RailTile controller={controller} className="md:order-3 xl:order-none xl:row-span-2" />
      <KpiTiles className="md:col-span-2 xl:col-span-3" />
      <div className="contents md:order-4 md:flex md:flex-col md:gap-[14px] xl:contents">
        <LedgerTile className="xl:col-span-3" />
        <WalletCard />
      </div>
    </div>
  );
}
