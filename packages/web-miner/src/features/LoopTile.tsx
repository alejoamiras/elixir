import { useAtomValue } from 'jotai';
import { PARAMS } from '../../../miner-core/src/generated/params.ts';
import { difficulty, nextWinSeconds, proofsPerMinute } from '../../../miner-core/src/metrics.ts';
import { Button, Kpi, ScoreLoop, StatusPill, Tile, TileHeader } from '../../../ui/src/index.ts';
import type { MinerController } from '../controller';
import { amount, compact, duration } from '../lib/format';
import { bootAtom, epochAtom, minerAtom } from '../state';

/** The heartbeat and the three numbers under it. */
export function LoopTile({ controller }: { controller: () => MinerController | undefined }) {
  const boot = useAtomValue(bootAtom);
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const perMinute = proofsPerMinute(miner.recent);
  const last = miner.recent[miner.recent.length - 1];
  const ready = boot.phase === 'ready';
  const bar = epoch ? difficulty(epoch.target) : 1;
  return (
    <Tile className="flex flex-col gap-4">
      <TileHeader
        className="mb-0"
        aside={
          <span className="flex items-center gap-3">
            {last !== undefined && miner.phase !== 'idle' && (
              <span className="font-mono text-xs text-ink-2">{(last / 1000).toFixed(2)} s per proof</span>
            )}
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
        <StatusPill
          status={miner.proverDead ? 'paused' : miner.phase}
          className="normal-case tracking-normal"
        >
          {miner.phase === 'mining' ? 'live · one dot per proof' : undefined}
        </StatusPill>
      </TileHeader>
      <ScoreLoop difficulty={bar} samples={miner.samples} winAt={miner.winAt} height={180} />
      {miner.lastError && (
        <p className="text-sm text-bad" data-testid="miner-error">
          {miner.lastError}
        </p>
      )}
      <div className="grid grid-cols-3 gap-4 border-t border-line pt-4">
        <Kpi
          label="rate"
          value={<span data-testid="rate">{perMinute.toFixed(1)}</span>}
          unit="proofs/min"
          sub={
            <>
              <span data-testid="tickets">{compact(miner.proofs)}</span> proofs this session
            </>
          }
        />
        <Kpi
          label="next win, at this rate"
          value={epoch && perMinute > 0 ? `~${duration(nextWinSeconds(epoch.target, perMinute))}` : '—'}
          sub="could be now, could be 3× longer"
        />
        <Kpi
          label="best this epoch"
          value={miner.best === null ? '—' : miner.best.toFixed(1)}
          unit={epoch ? `of ${bar.toFixed(1)}` : undefined}
          sub={`${miner.wins} ${miner.wins === 1 ? 'win' : 'wins'} · ${amount(PARAMS.REWARD * BigInt(miner.wins), PARAMS.DECIMALS)} ${PARAMS.TOKEN_SYMBOL} this session`}
        />
      </div>
    </Tile>
  );
}
