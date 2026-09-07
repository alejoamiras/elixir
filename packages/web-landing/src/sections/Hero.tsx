import { Fragment, useState } from 'react';
import { Button } from '../../../ui/src/index.ts';
import type { DemoJob } from '../../../web-miner/src/demo/index.ts';
import { copy } from '../copy';
import type { DemoState } from '../demo/machine';
import { useMobile } from '../hooks';
import type { Live } from '../live';
import { appHref } from '../state';
import { Demo } from './Demo';

/** The hero frame's grid and paddings; the launch-week hero shares them. */
export const HERO_FRAME = 'grid gap-[30px] px-4 py-10 md:grid-cols-[1fr_1.1fr] md:px-9 md:pt-14 md:pb-11';

/** The binder forces a break after the first sentence and balances the whole; below `md` it flows. */
export function Headline({ text }: { text: string }) {
  return (
    <h1 className="text-balance text-3xl font-semibold leading-[1.02] tracking-[-0.03em] md:text-[50px]">
      {text.split(/(?<=\.)\s+/).map((sentence, i) => (
        <Fragment key={sentence}>
          {i > 0 && <br className="hidden md:inline" />}
          {i > 0 && ' '}
          {sentence}
        </Fragment>
      ))}
    </h1>
  );
}

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
      <div className="flex flex-wrap gap-2.5">
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
    <section id="hero" className={HERO_FRAME} data-testid="hero">
      <div className="flex flex-col justify-center gap-5">
        <Headline text={copy.hero.headline} />
        <p className="max-w-[46ch] text-pretty text-lg leading-[1.45] text-ink-2">{copy.hero.subhead}</p>
        {mobile ? (
          <Mobile />
        ) : (
          <div className="flex flex-wrap gap-2.5">
            <Button variant="uv" size="lg" asChild>
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
        <p className="text-xs text-ink-3">{copy.hero.reassurance}</p>
      </div>
      {!mobile && <Demo open={open} job={job} state={demo} onProve={onProve} />}
    </section>
  );
}
