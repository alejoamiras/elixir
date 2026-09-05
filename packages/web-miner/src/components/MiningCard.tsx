import { useAtomValue } from 'jotai';
import { Button, StatusPill, Tile, TileHeader } from '../../../ui/src/index.ts';
import type { MinerController } from '../controller';
import { compact, duration, expectedSecondsToWin } from '../lib/format';
import { proofsPerSecond } from '../lib/reducer';
import { bootAtom, epochAtom, minerAtom } from '../state';

export function MiningCard({ controller }: { controller: () => MinerController | undefined }) {
  const boot = useAtomValue(bootAtom);
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const rate = proofsPerSecond(miner.recent);
  const ready = boot.phase === 'ready';
  return (
    <Tile>
      <TileHeader aside={<StatusPill status={miner.phase} data-testid="phase" />}>Mining</TileHeader>
      <div className="grid gap-3 text-sm">
        <div className="flex gap-2">
          <Button
            data-testid="start"
            variant="primary"
            disabled={!ready || miner.phase !== 'idle' || miner.proverDead}
            onClick={() => controller()?.start()}
          >
            Start
          </Button>
          <Button
            data-testid="stop"
            variant="outline"
            disabled={miner.phase !== 'mining'}
            onClick={() => controller()?.stop()}
          >
            Stop
          </Button>
          {ready && <span className="text-ink-2 self-center text-xs">{boot.threads} threads</span>}
        </div>
        <div className="flex justify-between">
          <span className="text-ink-2">Proofs / s</span>
          <span data-testid="rate">{rate.toFixed(3)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-2">Tickets tried this epoch</span>
          <span data-testid="tickets">{compact(miner.tickets)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-2">Expected time to a win</span>
          <span>{epoch ? duration(expectedSecondsToWin(epoch.target, rate)) : '—'}</span>
        </div>
        {miner.lastError && (
          <p className="text-bad" data-testid="miner-error">
            {miner.lastError}
          </p>
        )}
      </div>
    </Tile>
  );
}
