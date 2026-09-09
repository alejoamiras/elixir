import { useAtomValue } from 'jotai';
import { type ReactNode, useCallback, useEffect, useSyncExternalStore } from 'react';
import { proofsPerMinute } from '../../miner-core/src/metrics.ts';
import { defaultNodeUrl, restoreDefaultNode } from '../../site/src/browser/connection.ts';
import { previewNotice } from '../../site/src/browser/host.ts';
import { bannerState, nodeHealth, subscribeNodeHealth } from '../../site/src/browser/node-health.ts';
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  cn,
  Mark,
  NodeBanner,
  NodeWayOut,
  StatusPill,
  Toaster,
} from '../../ui/src/index.ts';
import { DesktopOnly } from './components/DesktopOnly';
import type { Connection } from './config';
import { isDesktop } from './desktop';
import { KeyScreen } from './features/KeyScreen';
import { useHotkeys, usePauses, useResumeOnOpen } from './features/use-page-behaviour';
import { pillStatus } from './lib/status';
import { navigate, pathFor, type Route, useRoute } from './routes';
import { Mine } from './routes/Mine';
import { Settings } from './routes/Settings';
import { Wallet } from './routes/Wallet';
import type { Session } from './session';
import { useSettings } from './settings';
import { bootAtom, epochAtom, minerAtom, nowAtom, rulesAtom } from './state';
import { applyTabStatus } from './tab-status';

/** The stats app lives beside this one on the same origin; standalone builds point at the assembled path. */
const statsHref = `${(import.meta.env.BASE_URL ?? '/').replace(/\/mine\/?$/, '/')}stats/`;
const NAV: ({ route: Route; label: string } | { href: string; label: string })[] = [
  { route: 'mine', label: 'Mine' },
  { route: 'wallet', label: 'Wallet' },
  { href: statsHref, label: 'Stats ↗' },
  { route: 'settings', label: 'Settings' },
];

function useTabStatus(enabled: boolean) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const rules = useAtomValue(rulesAtom);
  useEffect(() => {
    if (!enabled) return applyTabStatus({ mark: 'idle' });
    const perMinute = proofsPerMinute(miner.recent);
    applyTabStatus({
      mark: pillStatus(miner) === 'paused' ? 'paused' : miner.phase === 'idle' ? 'idle' : 'mining',
      ...(miner.phase !== 'idle' && perMinute > 0 && { rate: `${perMinute.toFixed(0)}/min` }),
      ...(epoch && rules && { claims: `${epoch.claims}/${rules.N}` }),
    });
  }, [enabled, miner, epoch, rules]);
}

/** The banner calls the numbers stale once the controller would have paused for silence (a minute). */
const STALE_AFTER_MS = 60_000;

export function Shell({ children }: { children: ReactNode }) {
  const route = useRoute();
  const miner = useAtomValue(minerAtom);
  const now = useAtomValue(nowAtom);
  const notice = previewNotice(location.hostname);
  const health = useSyncExternalStore(subscribeNodeHealth, nodeHealth, nodeHealth);
  const banner = bannerState(health, now, STALE_AFTER_MS);
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col">
      <header className="flex h-[52px] items-center gap-5 border-b border-line px-4 md:px-5">
        <span className="flex items-center gap-2 font-semibold">
          <Mark state={miner.phase === 'idle' ? 'idle' : 'mining'} />
          Yacana
        </span>
        <nav className="flex gap-4 text-sm" aria-label="miner">
          {NAV.map((n) =>
            'href' in n ? (
              <a
                key={n.href}
                href={n.href}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1 text-ink-2 hover:text-ink"
                data-testid="nav-stats"
              >
                {n.label}
              </a>
            ) : (
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
            ),
          )}
        </nav>
        <span className="ml-auto flex items-center gap-3">
          <Badge variant="warn">testnet · fees sponsored</Badge>
          <StatusPill status={pillStatus(miner, now)} data-testid="phase" />
        </span>
      </header>
      <div className="flex flex-col gap-4 p-4 md:p-5">
        {notice && (
          <Alert variant="warn" data-testid="preview-banner">
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        <NodeBanner state={banner} settingsHref={route === 'settings' ? undefined : pathFor('settings')} />
        {children}
      </div>
    </div>
  );
}

export function App({ connection, session }: { connection: Connection; session: Session }) {
  const boot = useAtomValue(bootAtom);
  const route = useRoute();
  const [settings] = useSettings();
  const controller = useCallback(() => session.controller, [session]);
  useTabStatus(settings.tabStatus);
  useHotkeys(controller);
  usePauses(controller, settings);
  useResumeOnOpen(controller);
  if (!isDesktop(window)) return <DesktopOnly />;
  const open = boot.phase === 'ready';
  return (
    <Shell>
      {boot.phase === 'error' && (
        <Alert variant="bad" data-testid="boot-error">
          <AlertTitle>Cannot start</AlertTitle>
          <AlertDescription>{boot.message}</AlertDescription>
          <NodeWayOut
            className="mt-2"
            onDefault={connection.nodeUrl === defaultNodeUrl() ? undefined : restoreDefaultNode}
            settingsHref={route === 'settings' ? undefined : pathFor('settings')}
          />
        </Alert>
      )}
      {!open && boot.phase !== 'error' && <KeyScreen session={session} />}
      {open && route === 'mine' && <Mine controller={controller} />}
      {open && route === 'wallet' && <Wallet session={session} />}
      {route === 'settings' && <Settings connection={connection} controller={controller} session={session} />}
      <p className="text-xs text-ink-2">
        Whoever serves this page controls it: a compromised host could redirect claims or spend this wallet.
        Run your own build if that matters. Chain reads come from the node in Settings and can only waste work
        if the node lies — claims are verified on-chain.
      </p>
      <Toaster />
    </Shell>
  );
}
