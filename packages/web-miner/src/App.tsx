import { useAtomValue } from 'jotai';
import { type ReactNode, useCallback, useEffect, useSyncExternalStore } from 'react';
import { proofsPerMinute } from '../../miner-core/src/metrics.ts';
import { defaultNodeUrl, restoreDefaultNode } from '../../site/src/browser/connection.ts';
import { shortAddress } from '../../site/src/browser/format.ts';
import { previewNotice } from '../../site/src/browser/host.ts';
import { bannerState, nodeHealth, subscribeNodeHealth } from '../../site/src/browser/node-health.ts';
import { ownVersionName } from '../../site/src/browser/version-name.ts';
import {
  AccountChip,
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Gear,
  Header,
  NodeBanner,
  NodeWayOut,
  StatusPill,
  statusLabel,
  Toaster,
} from '../../ui/src/index.ts';
import { isOldRole } from './bridge/env';
import { DesktopOnly } from './components/DesktopOnly';
import type { Connection } from './config';
import { isDesktop } from './desktop';
import { BridgeProviders } from './features/BridgeProviders';
import { PreflightTile } from './features/KeyScreen';
import { OldTabNotice } from './features/OldTabNotice';
import { PrestoBanner } from './features/PrestoBanner';
import { SignInDialog } from './features/SignInDialog';
import { TakingLongDialog } from './features/TakingLongDialog';
import { useHotkeys, usePauses, useResumeOnOpen } from './features/use-page-behaviour';
import { pillStatus } from './lib/status';
import { minerTabs } from './lib/tabs';
import { prestoAtom } from './presto';
import { navigate, pathFor, type Route, useRoute } from './routes';
import { Mine } from './routes/Mine';
import { Settings } from './routes/Settings';
import { Wallet } from './routes/Wallet';
import type { Session } from './session';
import { useSettings } from './settings';
import { bootAtom, epochAtom, minerAtom, nowAtom, rulesAtom, signInAtom } from './state';
import { applyTabStatus } from './tab-status';

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
  const boot = useAtomValue(bootAtom);
  const miner = useAtomValue(minerAtom);
  const now = useAtomValue(nowAtom);
  const notice = previewNotice(location.hostname);
  const health = useSyncExternalStore(subscribeNodeHealth, nodeHealth, nodeHealth);
  const banner = bannerState(health, now, STALE_AFTER_MS);
  const presto = useAtomValue(prestoAtom);
  const status = boot.phase === 'opening' ? 'opening' : pillStatus(miner, now);
  // The account chip leads to the money; on the old origin the wallet is the page itself, so to Settings.
  const accountRoute: Route = isOldRole() ? 'settings' : 'wallet';
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col">
      <Header
        version={ownVersionName()}
        homeHref={pathFor('mine')}
        onHome={() => navigate('mine')}
        mark={miner.phase === 'idle' ? 'idle' : 'mining'}
        navLabel="miner"
        tabs={minerTabs(route, navigate)}
        right={
          <>
            <Badge variant="net">testnet</Badge>
            <StatusPill status={status} data-testid="phase" data-prover={presto.active ?? undefined}>
              {statusLabel(status)}
              {presto.active === 'presto' && (
                <>
                  <span className="text-ink-4">·</span>
                  <span className="text-uv-2" data-testid="native">
                    <span className="font-semibold text-uv">✦</span> presto
                  </span>
                </>
              )}
            </StatusPill>
            {boot.phase === 'ready' && (
              <AccountChip
                address={shortAddress(boot.record.account.address)}
                href={pathFor(accountRoute)}
                onSelect={() => navigate(accountRoute)}
                data-testid="account-chip"
              />
            )}
            <Gear href={pathFor('settings')} onSelect={() => navigate('settings')} />
          </>
        }
      />
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
  const signIn = useAtomValue(signInAtom);
  const [settings] = useSettings();
  const controller = useCallback(() => session.controller, [session]);
  // Stable: the loop tile's controls hand `onStart` to the picture-in-picture window, which a new identity would close.
  const onStart = useCallback(() => session.startMining(), [session]);
  const onRetry = useCallback(() => void session.retryPresto(), [session]);
  // Settings stays reachable signed out (the node is changed there); everywhere else the sign-in
  // sits over the cockpit, and the page's keys are its while it shows.
  const dialogShowing =
    route !== 'settings' && (boot.phase === 'opening' || (boot.phase === 'signedOut' && signIn));
  useTabStatus(settings.tabStatus);
  useHotkeys(controller, onStart, !dialogShowing);
  usePauses(controller, settings);
  useResumeOnOpen(onStart);
  if (!isDesktop(window)) return <DesktopOnly />;
  const open = boot.phase === 'ready';
  const chain = open || boot.phase === 'signedOut' || boot.phase === 'opening';
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
      {boot.phase === 'preflight' && <PreflightTile rows={boot.rows} />}
      <OldTabNotice miner={connection.miner} rollupVersion={import.meta.env.VITE_ROLLUP_VERSION} />
      {chain && route === 'mine' && !isOldRole() && <PrestoBanner onRetry={onRetry} />}
      {chain && route === 'mine' && <Mine controller={controller} onStart={onStart} session={session} />}
      {open && route === 'wallet' && <Wallet session={session} />}
      {route === 'settings' && <Settings connection={connection} controller={controller} session={session} />}
      {route !== 'settings' && <SignInDialog session={session} />}
      {open && (
        <BridgeProviders>
          <TakingLongDialog onSettings={() => navigate('settings')} onWallet={() => navigate('wallet')} />
        </BridgeProviders>
      )}
      <p className="text-xs text-ink-2">
        Whoever serves this page controls it: a compromised host could redirect claims or spend this wallet.
        Run your own build if that matters. Chain reads come from the node in Settings and can only waste work
        if the node lies — claims are verified on-chain.
      </p>
      <Toaster />
    </Shell>
  );
}
