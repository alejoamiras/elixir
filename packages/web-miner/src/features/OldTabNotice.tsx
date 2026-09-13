// A tab left open across a redeploy: the served `/build.json` names the deployment the site now
// carries; when its miner or rollup differs from this tab's build, the tab must reload before it
// sends anything — a same-rollup redeploy is not caught by the PXE's node fingerprint, and it is
// never "flipped".
import { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle, Button } from '../../../ui/src/index.ts';

const EVERY_MS = 5 * 60_000;

export interface ServedBuild {
  miner?: string;
  rollupVersion?: string;
}

/** Whether the served build is another deployment than this tab's; an unreadable file is not. */
export const staleTab = (
  served: ServedBuild | null,
  mine: { miner: string; rollupVersion: string },
): boolean =>
  !!served?.miner &&
  !!served.rollupVersion &&
  (served.miner.toLowerCase() !== mine.miner.toLowerCase() || served.rollupVersion !== mine.rollupVersion);

const buildJsonUrl = () => `${(import.meta.env.BASE_URL ?? '/').replace(/\/mine\/?$/, '/')}build.json`;

export function OldTabNotice({ miner, rollupVersion }: { miner: string; rollupVersion: string }) {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    let live = true;
    const tick = async () => {
      try {
        const served = (await (await fetch(buildJsonUrl(), { cache: 'no-store' })).json()) as ServedBuild;
        if (live) setStale(staleTab(served, { miner, rollupVersion }));
      } catch {
        /* the site is unreachable or has no record: nothing to say */
      }
    };
    const timer = setInterval(() => void tick(), EVERY_MS);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [miner, rollupVersion]);
  if (!stale) return null;
  return (
    <Alert variant="warn" data-testid="old-tab">
      <AlertTitle>This tab is behind.</AlertTitle>
      <AlertDescription className="flex flex-wrap items-center gap-3">
        <span>
          Yacana has been redeployed since this page loaded; reload before you send or claim anything.
        </span>
        <Button size="sm" onClick={() => location.reload()}>
          Reload
        </Button>
      </AlertDescription>
    </Alert>
  );
}
