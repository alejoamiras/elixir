import { Provider, useAtomValue, useStore } from 'jotai';
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
import { pillStatus } from '../lib/status';
import { openPip, pipSupported } from '../pip';
import { useSettings } from '../settings';
import { bootAtom, epochAtom, minerAtom, nowAtom } from '../state';
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
            {last !== undefined && miner.phase !== 'idle' && (
              <span>
                {perProof.toFixed(2)} s per proof · {boot.phase === 'ready' ? boot.threads : '—'} threads ·{' '}
                {compact(miner.proofs)} proofs · {miner.wins} {miner.wins === 1 ? 'win' : 'wins'}
              </span>
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
        {status === 'paused' ? (
          <StatusPill status="paused" />
        ) : status === 'mining' ? (
          'live · last 3 min'
        ) : (
          status
        )}
      </TileHeader>
      <ScoreLoop calm difficulty={bar} samples={miner.samples} winAt={miner.winAt} height={230} />
      {nonClaimNotice && <NoticeCard notice={nonClaimNotice} recovering={miner.phase === 'recovering'} />}
    </Tile>
  );
}

const nextWin = (target: bigint, perMinute: number): [string, string] | null => {
  if (perMinute <= 0) return null;
  const [value, unit] = durationParts(nextWinSeconds(target, perMinute));
  return unit ? [`~${value}`, unit] : null;
};

export function KpiTiles({ className }: { className?: string }) {
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const perMinute = useTweenedNumber(proofsPerMinute(miner.recent));
  const bar = epoch ? difficulty(epoch.target) : 1;
  const next = epoch ? nextWin(epoch.target, proofsPerMinute(miner.recent)) : null;
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
          value={next ? next[0] : '—'}
          unit={next?.[1]}
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
