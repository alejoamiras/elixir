import { WalletCard } from '../components/WalletCard';
import type { MinerController } from '../controller';
import { LedgerTile } from '../features/LedgerTile';
import { LoopTile } from '../features/LoopTile';
import { RailTile } from '../features/RailTile';

/** Everything a miner needs while mining, on one screen; wallet and settings are routes. */
export function Mine({ controller }: { controller: () => MinerController | undefined }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <LoopTile controller={controller} />
      <RailTile controller={controller} />
      <LedgerTile />
      <WalletCard />
    </div>
  );
}
