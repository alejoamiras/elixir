import { useState } from 'react';
import { Button } from '../../../ui/src/index.ts';
import type { DemoJob } from '../../../web-miner/src/demo/index.ts';
import { copy } from '../copy';
import type { DemoState } from '../demo/machine';
import { useMobile } from '../hooks';
import type { Live } from '../live';
import { appHref } from '../state';
import { Demo } from './Demo';

/** The share sheet with the miner's link, or the clipboard where there is none. */
async function share(url: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'Yacana', url });
      return 'shared';
    }
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}

function Mobile() {
  const [note, setNote] = useState('');
  const url = new URL(appHref('mine'), location.href).href;
  return (
    <div className="flex flex-col gap-3" data-testid="hero-mobile">
      <p className="text-sm text-ink-2">{copy.hero.mobile}</p>
      <div className="flex flex-wrap gap-3">
        <Button
          variant="uv"
          data-testid="share"
          onClick={async () => setNote((await share(url)) === 'copied' ? copy.hero.copied : '')}
        >
          {copy.hero.share}
        </Button>
        <Button asChild>
          <a href={appHref('stats')}>{copy.hero.watch}</a>
        </Button>
      </div>
      {note && <p className="text-2xs text-ink-2">{note}</p>}
    </div>
  );
}

export function Hero({
  live,
  job,
  demo,
  onProve,
}: {
  live: Live | undefined;
  job: DemoJob | null;
  demo: DemoState;
  onProve: () => void;
}) {
  const mobile = useMobile();
  const open = live?.rows[live.rows.length - 1];
  return (
    <section
      id="hero"
      className="grid gap-8 py-12 md:grid-cols-2 md:items-center md:py-20"
      data-testid="hero"
    >
      <div className="flex flex-col gap-5">
        <h1 className="text-balance text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          {copy.hero.headline}
        </h1>
        <p className="text-pretty text-lg text-ink-2">{copy.hero.subhead}</p>
        {mobile ? (
          <Mobile />
        ) : (
          <div className="flex flex-wrap gap-3">
            <Button variant="primary" size="lg" asChild>
              <a href={appHref('mine')} data-testid="hero-mine">
                {copy.bar.mine}
              </a>
            </Button>
            <Button
              size="lg"
              onClick={onProve}
              disabled={!job || demo.phase === 'proving'}
              data-testid="hero-prove"
            >
              {copy.hero.prove}
            </Button>
          </div>
        )}
        <p className="text-sm text-ink-3">{copy.hero.reassurance}</p>
      </div>
      {!mobile && <Demo open={open} job={job} state={demo} onProve={onProve} />}
    </section>
  );
}
