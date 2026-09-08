import { previewNotice } from '../../site/src/browser/host.ts';
import { Alert, AlertDescription } from '../../ui/src/index.ts';
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
  return (
    <div className="mx-auto flex max-w-[1120px] flex-col">
      <Bar live={live.phase === 'ready' && !live.unreachable} />
      {notice && (
        <Alert variant="warn" className="mx-4 mt-4 md:mx-5" data-testid="preview-banner">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
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
