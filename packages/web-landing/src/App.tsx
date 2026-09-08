import { useSyncExternalStore } from 'react';
import {
  defaultNodeUrl,
  loadConnection,
  NODE_SETTINGS_HREF,
  restoreDefaultNode,
} from '../../site/src/browser/connection.ts';
import { previewNotice } from '../../site/src/browser/host.ts';
import { bannerState, nodeHealth, subscribeNodeHealth } from '../../site/src/browser/node-health.ts';
import { Alert, AlertDescription, NodeBanner } from '../../ui/src/index.ts';
import { useNow } from './hooks';
import { POLL_MS } from './live';
import { Ask, Footer } from './sections/Ask';
import { Bar } from './sections/Bar';
import { Chain, How } from './sections/Chain';
import { Hero } from './sections/Hero';
import { Launch } from './sections/Launch';
import { Money } from './sections/Money';
import { Verify } from './sections/Verify';
import { type LaunchStatus, type LiveStatus, launchMode } from './state';

export function App({ live, launch }: { live: LiveStatus; launch: LaunchStatus }) {
  const notice = previewNotice(location.hostname);
  const health = useSyncExternalStore(subscribeNodeHealth, nodeHealth, nodeHealth);
  const banner = bannerState(health, useNow() * 1000, 2 * POLL_MS);
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col">
      <Bar live={live.phase === 'ready' && !live.unreachable} />
      {notice && (
        <Alert variant="warn" className="mx-4 mt-4 md:mx-5" data-testid="preview-banner">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <div className="mx-4 mt-4 empty:hidden md:mx-5">
        <NodeBanner
          state={banner}
          settingsHref={NODE_SETTINGS_HREF}
          onDefault={loadConnection().nodeUrl === defaultNodeUrl() ? undefined : restoreDefaultNode}
        />
      </div>
      <main>
        {launchMode() ? <Launch status={launch} live={live} /> : <Hero status={live} />}
        <Money />
        <Chain />
        <How />
        <Verify />
        <Ask />
      </main>
      <Footer />
    </div>
  );
}
