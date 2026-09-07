import { WalletCard } from '../components/WalletCard';
import type { MinerController } from '../controller';
import { LedgerTile } from '../features/LedgerTile';
import { KpiTiles, LoopTile } from '../features/LoopTile';
import { RailTile } from '../features/RailTile';

/**
 * Everything a miner needs while mining, on one screen; wallet and settings are routes. From `xl`
 * the M1 frame: three columns and a 300-px rail, the loop over the three, the rail spanning the
 * loop and the KPI row, the ledger over the three, the key tile under the rail. Between `md` and
 * `xl` the rail drops under the numbers: loop and KPIs first, then the rail beside the ledger and
 * the key tile stacked. Tiles size to their content (`items-start`): the ledger is a log, not a panel.
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
