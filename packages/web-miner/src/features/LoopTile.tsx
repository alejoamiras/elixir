import { Provider, useAtomValue, useSetAtom, useStore } from 'jotai';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty, nextWinSeconds, proofsPerMinute } from '../../../miner-core/src/metrics.ts';
import {
  Button,
  cn,
  Kpi,
  Mark,
  ScoreLoop,
  StatusPill,
  Tile,
  TileHeader,
  useTweenedNumber,
} from '../../../ui/src/index.ts';
import type { MinerController } from '../controller';
import { amount, compact, durationParts } from '../lib/format';
import type { MinerState } from '../lib/reducer';
import { pillStatus } from '../lib/status';

const cores = () => navigator.hardwareConcurrency || 2;

import { openPip, pipSupported } from '../pip';
import { useSettings } from '../settings';
import { bootAtom, epochAtom, minerAtom, nowAtom, signInAtom } from '../state';
import { NoticeCard } from './ClaimStatus';

/** The mini window: the state and Stop, the last minute of the loop as a strip, then rate · epoch · wins. */
function PipView({ controller, win }: { controller: () => MinerController | undefined; win: Window }) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const now = useAtomValue(nowAtom);
  const perMinute = useTweenedNumber(proofsPerMinute(miner.recent));
  const bar = epoch ? difficulty(epoch.target) : null;
  return (
    <div className="flex h-full flex-col justify-between bg-ground p-3 text-ink">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Mark state={miner.phase === 'mining' ? 'mining' : 'idle'} />
          <StatusPill status={pillStatus(miner, now)} />
        </span>
        {miner.phase === 'mining' ? (
          <Button size="sm" onClick={() => controller()?.stop()}>
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            variant="primary"
            disabled={miner.phase !== 'idle'}
            onClick={() => controller()?.start()}
          >
            Start
          </Button>
        )}
      </div>
      <ScoreLoop
        calm
        difficulty={bar}
        samples={miner.samples}
        winAt={miner.winAt}
        height={48}
        spanMs={60_000}
        geometry={{ pad: 4, fontPx: 10 }}
        win={win}
      />
      <div className="flex items-baseline justify-between gap-2 whitespace-nowrap font-mono text-[10px] text-ink-2">
        <span>
          <span className="font-sans text-lg font-semibold tracking-[-0.02em] text-ink">
            {perMinute.toFixed(1)}
          </span>{' '}
          proofs/min
        </span>
        {epoch && (
          <span>
            epoch {epoch.epoch.toString()} · <span className="text-ink">{epoch.claims}</span> of {PARAMS.N} ·
            bar {bar === null ? '—' : bar.toFixed(1)}
          </span>
        )}
        <span className="text-ok">
          {miner.wins} {miner.wins === 1 ? 'win' : 'wins'} ·{' '}
          {amount(PARAMS.REWARD * BigInt(miner.wins), PARAMS.DECIMALS)} {PARAMS.TOKEN_SYMBOL}
        </span>
      </div>
    </div>
  );
}

function PopOut({ controller }: { controller: () => MinerController | undefined }) {
  const store = useStore();
  const [pip, setPip] = useState<Window | null>(null);
  useEffect(() => {
    if (!pip) return;
    const root = createRoot(pip.document.body);
    root.render(
      <Provider store={store}>
        <PipView controller={controller} win={pip} />
      </Provider>,
    );
    const onHide = () => setPip(null);
    pip.addEventListener('pagehide', onHide);
    return () => {
      pip.removeEventListener('pagehide', onHide);
      root.unmount();
      pip.close();
    };
  }, [pip, store, controller]);
  return (
    <Button
      size="sm"
      disabled={pip !== null}
      onClick={() => void openPip().then(setPip)}
      data-testid="pop-out"
    >
      Pop out
    </Button>
  );
}

/** Start's place: opening while an account comes up, the way in while none is, Stop/Start otherwise. */
function StartControl({
  ready,
  opening,
  miner,
  controller,
}: {
  ready: boolean;
  opening: boolean;
  miner: MinerState;
  controller: () => MinerController | undefined;
}) {
  const openSignIn = useSetAtom(signInAtom);
  if (opening)
    return (
      <Button size="sm" variant="primary" disabled data-testid="start-opening">
        opening…
      </Button>
    );
  if (!ready)
    return (
      <Button size="sm" variant="uv" data-testid="sign-in-mine" onClick={() => openSignIn(true)}>
        Sign in to mine
      </Button>
    );
  if (miner.phase === 'mining')
    return (
      <Button size="sm" data-testid="stop" onClick={() => controller()?.stop()}>
        Stop
      </Button>
    );
  return (
    <Button
      size="sm"
      variant="primary"
      data-testid="start"
      disabled={miner.phase !== 'idle' || miner.proverDead}
      onClick={() => controller()?.start()}
    >
      Start mining
    </Button>
  );
}

/** The header's left: the pill when paused; "live" while mining or before any account; else the status. */
function HeaderText({ status, ready }: { status: ReturnType<typeof pillStatus>; ready: boolean }) {
  if (status === 'paused') return <StatusPill status="paused" />;
  return <>{status === 'mining' || !ready ? 'live · last 3 min' : status}</>;
}

/** The rate line: dashes before any account, the session's numbers once proofs exist. */
function RateLine({
  ready,
  threads,
  miner,
  perProof,
}: {
  ready: boolean;
  threads: number;
  miner: MinerState;
  perProof: number;
}) {
  if (!ready) return <span>— per proof · {threads} threads · 0 proofs</span>;
  if (!miner.recent.length || miner.phase === 'idle') return null;
  return (
    <span>
      {perProof.toFixed(2)} s per proof · {threads} threads · {compact(miner.proofs)} proofs · {miner.wins}{' '}
      {miner.wins === 1 ? 'win' : 'wins'}
    </span>
  );
}

/** The header row is a fixed-height status line: the claim's progress lives in the rail, not here. */
export function LoopTile({
  controller,
  className,
}: {
  controller: () => MinerController | undefined;
  className?: string;
}) {
  const boot = useAtomValue(bootAtom);
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const now = useAtomValue(nowAtom);
  const [settings] = useSettings();
  const last = miner.recent[miner.recent.length - 1];
  const perProof = useTweenedNumber(last === undefined ? 0 : last / 1000);
  const ready = boot.phase === 'ready';
  const opening = boot.phase === 'opening';
  const threads = boot.phase === 'ready' ? boot.threads : (settings.threads ?? Math.max(1, cores() - 1));
  const bar = epoch ? difficulty(epoch.target) : null;
  const status = pillStatus(miner, now);
  const nonClaimNotice =
    miner.notice &&
    (miner.notice.kind === 'prover-dead' || miner.notice.kind === 'offline' || miner.notice.kind === 'paused')
      ? miner.notice
      : null;
  return (
    <Tile className={cn('flex flex-col gap-4', className)}>
      <TileHeader
        className="mb-0 h-[30px] items-center"
        aside={
          <span className="flex items-center gap-3">
            <RateLine ready={ready} threads={threads} miner={miner} perProof={perProof} />
            {settings.pip && pipSupported() && <PopOut controller={controller} />}
            <StartControl ready={ready} opening={opening} miner={miner} controller={controller} />
          </span>
        }
      >
        <HeaderText status={status} ready={ready} />
      </TileHeader>
      <ScoreLoop
        calm
        difficulty={bar}
        samples={miner.samples}
        winAt={miner.winAt}
        height={230}
        placeholder={ready ? undefined : 'sign in to start proving'}
      />
      {nonClaimNotice && <NoticeCard notice={nonClaimNotice} recovering={miner.phase === 'recovering'} />}
    </Tile>
  );
}

const nextWin = (target: bigint, perMinute: number): [string, string] | null => {
  if (perMinute <= 0) return null;
  const [value, unit] = durationParts(nextWinSeconds(target, perMinute));
  return unit ? [`~${value}`, unit] : null;
};

/** Signed out the values are dashes and the subs say what would fill them. */
function kpiSubs(
  ready: boolean,
  hasEpoch: boolean,
  bar: number,
  miner: MinerState,
): { next: string; best: string } {
  if (ready)
    return {
      next: 'could be now, could be 3× longer',
      best: `${miner.wins} ${miner.wins === 1 ? 'win' : 'wins'} · ${amount(PARAMS.REWARD * BigInt(miner.wins), PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL} this session`,
    };
  return {
    next: hasEpoch
      ? `the bar is ${bar.toFixed(1)} · about ${Math.max(1, Math.round(bar))} proofs per win`
      : 'the bar is not read yet',
    best: 'sign in to start',
  };
}

export function KpiTiles({ className }: { className?: string }) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const ready = useAtomValue(bootAtom).phase === 'ready';
  const perMinute = useTweenedNumber(proofsPerMinute(miner.recent));
  const bar = epoch ? difficulty(epoch.target) : 1;
  const next = ready && epoch ? nextWin(epoch.target, proofsPerMinute(miner.recent)) : null;
  const subs = kpiSubs(ready, epoch !== null, bar, miner);
  return (
    <div className={cn('grid grid-cols-3 gap-[14px]', className)} data-testid="kpi-tiles">
      <Tile>
        <Kpi
          size="lg"
          label="rate"
          value={<span data-testid="rate">{ready ? perMinute.toFixed(1) : '—'}</span>}
          unit="proofs/min"
          sub={
            ready ? (
              <>
                <span data-testid="tickets">{compact(miner.proofs)}</span> proofs this session
              </>
            ) : (
              'no proofs yet'
            )
          }
        />
      </Tile>
      <Tile>
        <Kpi
          size="lg"
          label="next win, at this rate"
          value={next ? next[0] : '—'}
          unit={next?.[1]}
          sub={subs.next}
        />
      </Tile>
      <Tile>
        <Kpi
          size="lg"
          label="best this epoch"
          value={ready && miner.best !== null ? miner.best.toFixed(1) : '—'}
          unit={ready && epoch ? `of ${bar.toFixed(1)}` : undefined}
          sub={subs.best}
        />
      </Tile>
    </div>
  );
}
