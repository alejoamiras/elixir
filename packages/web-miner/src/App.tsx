import { useAtomValue } from 'jotai';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Toaster } from '@/components/ui/sonner';
import { ConnectionCard } from './components/ConnectionCard';
import { EpochCard } from './components/EpochCard';
import { LogCard } from './components/LogCard';
import { MiningCard } from './components/MiningCard';
import { WalletCard } from './components/WalletCard';
import type { Connection } from './config';
import type { MinerController } from './controller';
import { bootAtom } from './state';

export function App({
  connection,
  controller,
}: {
  connection: Connection;
  controller: () => MinerController | undefined;
}) {
  const boot = useAtomValue(bootAtom);
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
      <header className="flex items-baseline justify-between">
        <h1 className="font-heading text-2xl font-semibold tracking-tight">elixir miner</h1>
        <span className="text-muted-foreground text-sm">proof-of-proving on Aztec</span>
      </header>
      {boot.phase === 'error' && (
        <Alert variant="destructive" data-testid="boot-error">
          <AlertTitle>Cannot start</AlertTitle>
          <AlertDescription>{boot.message}</AlertDescription>
        </Alert>
      )}
      <ConnectionCard connection={connection} />
      <WalletCard />
      <EpochCard controller={controller} />
      <MiningCard controller={controller} />
      <LogCard />
      <p className="text-muted-foreground text-xs">
        Whoever serves this page controls it: a compromised host could redirect claims or spend this wallet.
        Run your own build if that matters. Chain reads come from the configured node and can only waste work
        if the node lies — claims are verified on-chain.
      </p>
      <Toaster />
    </main>
  );
}
