import { useCallback } from 'react';
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
  const onProve = useCallback(() => {
    if (job) void demo.start(job);
  }, [job, demo.start]);
  return (
    <div className="mx-auto flex max-w-5xl flex-col px-4 md:px-8">
      <Bar live={live.phase === 'ready' && !live.unreachable} />
      <main>
        {launchMode() ? (
          <Launch status={launch} open={current?.open} />
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
