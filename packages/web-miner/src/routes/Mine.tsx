import { EpochCard } from '../components/EpochCard';
import { LogCard } from '../components/LogCard';
import { MiningCard } from '../components/MiningCard';
import { WalletCard } from '../components/WalletCard';
import type { MinerController } from '../controller';

export function Mine({ controller }: { controller: () => MinerController | undefined }) {
  return (
    <>
      <WalletCard />
      <EpochCard controller={controller} />
      <MiningCard controller={controller} />
      <LogCard />
    </>
  );
}
