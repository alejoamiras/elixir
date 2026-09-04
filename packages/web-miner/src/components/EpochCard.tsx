import { useAtomValue } from 'jotai';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { MinerController } from '../controller';
import { compact, difficulty, duration } from '../lib/format';
import { epochAtom, nowAtom, rulesAtom } from '../state';

export function EpochCard({ controller }: { controller: () => MinerController | undefined }) {
  const epoch = useAtomValue(epochAtom);
  const rules = useAtomValue(rulesAtom);
  const now = useAtomValue(nowAtom);
  if (!epoch || !rules) return null;
  const age = Math.max(0, Math.floor(now / 1000) - Number(epoch.openedAt));
  const rollable = BigInt(age) >= rules.T_MAX;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>
          Epoch <span data-testid="epoch">{epoch.epoch.toString()}</span>
        </CardTitle>
        {rollable && (
          <Button size="sm" variant="outline" onClick={() => void controller()?.roll()}>
            Roll (T_MAX reached)
          </Button>
        )}
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-muted-foreground">Claims</span>
            <span data-testid="epoch-claims">
              {epoch.claims} / {rules.N}
            </span>
          </div>
          <Progress value={(100 * epoch.claims) / rules.N} />
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Difficulty (expected proofs per win)</span>
          <span>{compact(difficulty(epoch.target))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Target</span>
          <code className="truncate">0x{epoch.target.toString(16)}</code>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Open for</span>
          <span>
            {duration(age)} of {duration(Number(rules.EXPECTED_EPOCH_SECONDS))} expected
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
