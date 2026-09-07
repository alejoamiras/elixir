import { useCallback } from 'react';
import { previewNotice } from '../../site/src/browser/host.ts';
import { Alert, AlertDescription } from '../../ui/src/index.ts';
import { demoJob, useDemo } from './demo/useDemo';
import { Ask, Footer } from './sections/Ask';
import { Bar } from './sections/Bar';
import { Chain, How } from './sections/Chain';
import { Hero } from './sections/Hero';
import { Launch } from './sections/Launch';
import { Live } from './sections/Live';
import { Money } from './sections/Money';
import { Verify } from './sections/Verify';
import { type LaunchStatus, type LiveStatus, launchMode } from './state';

export function App({ live, launch, miner }: { live: LiveStatus; launch: LaunchStatus; miner: string }) {
  const current = live.phase === 'ready' ? live.live : undefined;
  const open = current?.rows[current.rows.length - 1];
  const job = demoJob(open, miner);
  const demo = useDemo();
  const notice = previewNotice(location.hostname);
  const onProve = useCallback(() => {
    if (job) void demo.start(job);
  }, [job, demo.start]);
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col">
      <Bar live={live.phase === 'ready' && !live.unreachable} />
      {notice && (
        <Alert variant="warn" className="mx-4 mt-4 md:mx-5" data-testid="preview-banner">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      <main>
        {launchMode() ? (
          <Launch status={launch} live={live} />
        ) : (
          <Hero live={current} job={job} demo={demo.state} onProve={onProve} />
        )}
        <Money />
        <Chain />
        <How />
        <Live status={live} />
        <Verify />
        <Ask />
      </main>
      <Footer />
    </div>
  );
}
