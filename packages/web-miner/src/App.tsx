import { useAtomValue } from 'jotai';
import { type ReactNode, useEffect } from 'react';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  cn,
  Mark,
  StatusPill,
  Toaster,
} from '../../ui/src/index.ts';
import { DesktopOnly } from './components/DesktopOnly';
import type { Connection } from './config';
import type { MinerController } from './controller';
import { isDesktop } from './desktop';
import { hostKind } from './host';
import { proofsPerSecond } from './lib/reducer';
import { navigate, type Route, useRoute } from './routes';
import { Mine } from './routes/Mine';
import { Settings } from './routes/Settings';
import { Wallet } from './routes/Wallet';
import { bootAtom, epochAtom, minerAtom, rulesAtom } from './state';
import { applyTabStatus } from './tab-status';

const NAV: { route: Route; label: string }[] = [
  { route: 'mine', label: 'Mine' },
  { route: 'wallet', label: 'Wallet' },
  { route: 'settings', label: 'Settings' },
];

function useTabStatus() {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const rules = useAtomValue(rulesAtom);
  useEffect(() => {
    const perMinute = proofsPerSecond(miner.recent) * 60;
    applyTabStatus({
      mark: miner.proverDead ? 'paused' : miner.phase === 'idle' ? 'idle' : 'mining',
      ...(miner.phase !== 'idle' && perMinute > 0 && { rate: `${perMinute.toFixed(0)}/min` }),
      ...(epoch && rules && { claims: `${epoch.claims}/${rules.N}` }),
    });
  }, [miner, epoch, rules]);
}

function Shell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const miner = useAtomValue(minerAtom);
  const kind = hostKind(location.hostname);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-8">
      <header className="flex h-[52px] items-center gap-5 border-b border-line">
        <span className="flex items-center gap-2 font-semibold">
          <Mark state={miner.phase === 'idle' ? 'idle' : 'mining'} />
          Yacana
        </span>
        <nav className="flex gap-4 text-sm" aria-label="miner">
          {NAV.map((n) => (
            <a
              key={n.route}
              href={`#${n.route}`}
              aria-current={route === n.route ? 'page' : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.route);
              }}
              className={cn(
                'py-1 text-ink-2 hover:text-ink',
                route === n.route && 'text-ink underline underline-offset-[18px]',
              )}
            >
              {n.label}
            </a>
          ))}
        </nav>
        <span className="ml-auto flex items-center gap-3">
          <Badge variant="warn">testnet · fees sponsored</Badge>
          <StatusPill status={miner.proverDead ? 'paused' : miner.phase} data-testid="phase" />
        </span>
      </header>
      {(kind === 'preview' || kind === 'unknown') && (
        <Alert variant="warn" data-testid="preview-banner">
          <AlertTitle>Preview build</AlertTitle>
          <AlertDescription>
            This is not {import.meta.env.VITE_RP_ID}: keys cannot be created or restored here.
          </AlertDescription>
        </Alert>
      )}
      {children}
    </div>
  );
}

export function App({
  connection,
  controller,
}: {
  connection: Connection;
  controller: () => MinerController | undefined;
}) {
  const boot = useAtomValue(bootAtom);
  const route = useRoute();
  useTabStatus();
  if (!isDesktop(window)) return <DesktopOnly />;
  return (
    <Shell>
      {boot.phase === 'error' && (
        <Alert variant="bad" data-testid="boot-error">
          <AlertTitle>Cannot start</AlertTitle>
          <AlertDescription>{boot.message}</AlertDescription>
        </Alert>
      )}
      {route === 'mine' && <Mine controller={controller} />}
      {route === 'wallet' && <Wallet />}
      {route === 'settings' && <Settings connection={connection} />}
      <p className="text-xs text-ink-2">
        Whoever serves this page controls it: a compromised host could redirect claims or spend this wallet.
        Run your own build if that matters. Chain reads come from the node in Settings and can only waste work
        if the node lies — claims are verified on-chain.
      </p>
      <Toaster />
    </Shell>
  );
}
