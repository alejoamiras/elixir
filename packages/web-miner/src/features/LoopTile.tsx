import { Provider, useAtomValue, useStore } from 'jotai';
import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty, nextWinSeconds, proofsPerMinute } from '../../../miner-core/src/metrics.ts';
import { Button, cn, Kpi, ScoreLoop, StatusPill, Tile, TileHeader } from '../../../ui/src/index.ts';
import type { MinerController } from '../controller';
import { amount, compact, duration } from '../lib/format';
import { pillStatus } from '../lib/status';
import { openPip, pipSupported } from '../pip';
import { useSettings } from '../settings';
import { bootAtom, epochAtom, minerAtom } from '../state';
import { ClaimStepper, MintedMarks, NoticeCard } from './ClaimStatus';

/** What the mini window shows: the pill, the rate, the best, and the one button. */
function PipView({ controller }: { controller: () => MinerController | undefined }) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const perMinute = proofsPerMinute(miner.recent);
  return (
    <div className="flex h-full flex-col justify-between bg-bg p-3 text-ink">
      <div className="flex items-center justify-between">
        <StatusPill status={pillStatus(miner)} />
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
      <div className="grid grid-cols-2 gap-3">
        <Kpi label="rate" value={perMinute.toFixed(1)} unit="proofs/min" />
        <Kpi
          label="best this epoch"
          value={miner.best === null ? '—' : miner.best.toFixed(1)}
          unit={epoch ? `of ${difficulty(epoch.target).toFixed(1)}` : undefined}
        />
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
        <PipView controller={controller} />
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

/** The heartbeat: the binder's loop tile with its header row. */
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
  const [settings] = useSettings();
  const last = miner.recent[miner.recent.length - 1];
  const ready = boot.phase === 'ready';
  const bar = epoch ? difficulty(epoch.target) : 1;
  return (
    <Tile className={cn('flex flex-col gap-4', className)}>
      <TileHeader
        className="mb-0"
        aside={
          <span className="flex items-center gap-3">
            {last !== undefined && miner.phase !== 'idle' && (
              <span className="font-mono text-xs text-ink-2">{(last / 1000).toFixed(2)} s per proof</span>
            )}
            {settings.pip && pipSupported() && <PopOut controller={controller} />}
            {miner.phase === 'mining' ? (
              <Button size="sm" data-testid="stop" onClick={() => controller()?.stop()}>
                Stop
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                data-testid="start"
                disabled={!ready || miner.phase !== 'idle' || miner.proverDead}
                onClick={() => controller()?.start()}
              >
                Start mining
              </Button>
            )}
          </span>
        }
      >
        <StatusPill status={pillStatus(miner)} className="normal-case tracking-normal">
          {miner.phase === 'mining' ? 'live · one dot per proof' : undefined}
        </StatusPill>
      </TileHeader>
      {miner.claim && <ClaimStepper claim={miner.claim} />}
      <ScoreLoop difficulty={bar} samples={miner.samples} winAt={miner.winAt} height={230} />
      {miner.minted && <MintedMarks minted={miner.minted} />}
      {miner.notice && <NoticeCard notice={miner.notice} recovering={miner.phase === 'recovering'} />}
    </Tile>
  );
}

/** The three numbers under the loop, one tile each: the binder's KPI row. */
export function KpiTiles({ className }: { className?: string }) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const perMinute = proofsPerMinute(miner.recent);
  const bar = epoch ? difficulty(epoch.target) : 1;
  return (
    <div className={cn('grid grid-cols-3 gap-[14px]', className)} data-testid="kpi-tiles">
      <Tile>
        <Kpi
          size="lg"
          label="rate"
          value={<span data-testid="rate">{perMinute.toFixed(1)}</span>}
          unit="proofs/min"
          sub={
            <>
              <span data-testid="tickets">{compact(miner.proofs)}</span> proofs this session
            </>
          }
        />
      </Tile>
      <Tile>
        <Kpi
          size="lg"
          label="next win, at this rate"
          value={epoch && perMinute > 0 ? `~${duration(nextWinSeconds(epoch.target, perMinute))}` : '—'}
          sub="could be now, could be 3× longer"
        />
      </Tile>
      <Tile>
        <Kpi
          size="lg"
          label="best this epoch"
          value={miner.best === null ? '—' : miner.best.toFixed(1)}
          unit={epoch ? `of ${bar.toFixed(1)}` : undefined}
          sub={`${miner.wins} ${miner.wins === 1 ? 'win' : 'wins'} · ${amount(PARAMS.REWARD * BigInt(miner.wins), PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL} this session`}
        />
      </Tile>
    </div>
  );
}
