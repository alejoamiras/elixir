// A tab left open across a redeploy: the served `/build.json` names the deployment the site now
// carries; when its miner or rollup differs from this tab's build, the tab must reload before it
// sends anything — a same-rollup redeploy is not caught by the PXE's node fingerprint, and it is
// never "flipped". Drawn as the one-line bar with its two actions.
import { useEffect, useState } from 'react';
import { Button } from '../../../ui/src/index.ts';
import { servedBuild, staleTab } from '../bridge/env';

export { staleTab } from '../bridge/env';

const EVERY_MS = 5 * 60_000;
/** The first look, once the page has settled; a redeploy during the boot is caught here. */
const FIRST_MS = 20_000;

const oldOrigin = (): string | undefined => import.meta.env.VITE_OLD_APP_ORIGIN || undefined;

export function OldTabNotice({ miner, rollupVersion }: { miner: string; rollupVersion: string }) {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      const served = await servedBuild();
      if (live) setStale(staleTab(served, { miner, rollupVersion }));
    };
    const timer = setInterval(() => void tick(), EVERY_MS);
    const first = setTimeout(() => void tick(), FIRST_MS);
    // A tab brought back to the front asks at once: that is when a stale tab is about to be used.
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      clearInterval(timer);
      clearTimeout(first);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [miner, rollupVersion]);
  if (!stale) return null;
  const old = oldOrigin();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-[6px] border border-warn/45 px-3.5 py-2.5 text-sm text-warn"
      data-testid="old-tab"
    >
      <span className="flex items-center gap-2.5">
        <i aria-hidden className="size-1.5 shrink-0 rounded-full bg-warn" />
        <span>
          <b className="font-semibold">This tab is behind.</b> Yacana has been redeployed at this address;
          reload to open it before you send or claim anything.
          {old ? ` What is still on V${rollupVersion} can be sent ahead from the old app.` : ''}
        </span>
      </span>
      <span className="flex items-center gap-3.5 whitespace-nowrap">
        <Button size="sm" className="text-ink" onClick={() => location.reload()}>
          Reload
        </Button>
        {old && (
          <a href={old} className="underline underline-offset-3" target="_blank" rel="noopener noreferrer">
            {new URL(old).host} ↗
          </a>
        )}
      </span>
    </div>
  );
}
