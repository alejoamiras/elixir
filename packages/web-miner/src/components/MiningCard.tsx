import { useAtomValue } from 'jotai';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MinerController } from '../controller';
import { compact, duration, expectedSecondsToWin } from '../lib/format';
import { proofsPerSecond } from '../lib/reducer';
import { bootAtom, epochAtom, minerAtom } from '../state';

const labels = { idle: 'idle', mining: 'mining', claiming: 'claiming' } as const;

export function MiningCard({ controller }: { controller: () => MinerController | undefined }) {
  const boot = useAtomValue(bootAtom);
  const miner = useAtomValue(minerAtom);
  const epoch = useAtomValue(epochAtom);
  const rate = proofsPerSecond(miner.recent);
  const ready = boot.phase === 'ready';
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Mining</CardTitle>
        <Badge variant={miner.phase === 'idle' ? 'outline' : 'default'} data-testid="phase">
          {labels[miner.phase]}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex gap-2">
          <Button
            data-testid="start"
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
          {ready && <span className="text-muted-foreground self-center text-xs">{boot.threads} threads</span>}
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Proofs / s</span>
          <span data-testid="rate">{rate.toFixed(3)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Tickets tried this epoch</span>
          <span data-testid="tickets">{compact(miner.tickets)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Expected time to a win</span>
          <span>{epoch ? duration(expectedSecondsToWin(epoch.target, rate)) : '—'}</span>
        </div>
        {miner.lastError && (
          <p className="text-destructive" data-testid="miner-error">
            {miner.lastError}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
