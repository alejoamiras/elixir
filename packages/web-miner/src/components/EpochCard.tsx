import { useAtomValue } from 'jotai';
import { Button, Progress, Tile, TileHeader } from '../../../ui/src/index.ts';
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
    <Tile>
      <TileHeader
        aside={
          rollable && (
            <Button size="sm" variant="uv" onClick={() => void controller()?.roll()}>
              Roll (T_MAX reached)
            </Button>
          )
        }
      >
        Epoch <span data-testid="epoch">{epoch.epoch.toString()}</span>
      </TileHeader>
      <div className="grid gap-3 text-sm">
        <div>
          <div className="mb-1 flex justify-between">
            <span className="text-ink-2">Claims</span>
            <span data-testid="epoch-claims">
              {epoch.claims} / {rules.N}
            </span>
          </div>
          <Progress value={(100 * epoch.claims) / rules.N} />
        </div>
        <div className="flex justify-between">
          <span className="text-ink-2">Difficulty (expected proofs per win)</span>
          <span>{compact(difficulty(epoch.target))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-2">Target</span>
          <code className="truncate">0x{epoch.target.toString(16)}</code>
        </div>
        <div className="flex justify-between">
          <span className="text-ink-2">Open for</span>
          <span>
            {duration(age)} of {duration(Number(rules.EXPECTED_EPOCH_SECONDS))} expected
          </span>
        </div>
      </div>
    </Tile>
  );
}
