import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { closePreview, difficulty, escapeHatchIn, proofsPerMinute } from '../../../miner-core/src/metrics.ts';
import { cn, EpochRail, PowerSlider, Tile, TileHeader } from '../../../ui/src/index.ts';
import type { MinerController } from '../controller';
import { duration } from '../lib/format';
import { prestoAtom } from '../presto';
import { useSettings } from '../settings';
import { bootAtom, claimsAtom, epochAtom, minerAtom, nowAtom, rulesAtom } from '../state';
import { ClaimSlot } from './ClaimSlot';

const cores = () => navigator.hardwareConcurrency || 2;

export function RailTile({
  controller,
  className,
}: {
  controller: () => MinerController | undefined;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-[14px]', className)} data-testid="rail">
      <ClaimSlot />
      <EpochTile controller={controller} />
    </div>
  );
}

function EpochTile({ controller }: { controller: () => MinerController | undefined }) {
  const epoch = useAtomValue(epochAtom);
  const rules = useAtomValue(rulesAtom);
  const now = useAtomValue(nowAtom);
  const miner = useAtomValue(minerAtom);
  const boot = useAtomValue(bootAtom);
  const claims = useAtomValue(claimsAtom);
  const [settings, setSettings] = useSettings();
  const [closing, setClosing] = useState(false);
  const native = useAtomValue(prestoAtom).active === 'presto';
  const threads = settings.threads ?? Math.max(1, cores() - 1);
  const setThreads = (t: number) => {
    setSettings({ threads: t });
    controller()?.reconfigure(t);
  };
  const nowSec = BigInt(Math.floor(now / 1000));
  return (
    <Tile className="flex flex-col gap-5">
      {epoch && rules ? (
        <EpochRail
          epoch={Number(epoch.epoch)}
          claims={epoch.claims}
          n={rules.N}
          mine={claims.filter((c) => c.epoch === epoch.epoch).map((_, i) => i)}
          aside={`opened ${new Date(Number(epoch.openedAt) * 1000).toISOString().slice(11, 19)}`}
          hatchSeconds={Number(escapeHatchIn(epoch.openedAt, rules.T_MAX, nowSec))}
          closing={closing}
          onClose={() => {
            setClosing(true);
            void controller()
              ?.roll()
              .finally(() => setClosing(false));
          }}
          rows={[
            {
              label: 'claims',
              value: (
                <span data-testid="epoch-claims">
                  {epoch.claims} of {rules.N}
                </span>
              ),
            },
            { label: 'difficulty', value: difficulty(epoch.target).toFixed(1) },
            { label: 'open for', value: duration(Math.max(0, Number(nowSec - epoch.openedAt))) },
            { label: 'expected close', value: duration(Number(rules.EXPECTED_EPOCH_SECONDS)) },
            {
              label: 'if it closed now',
              value: `difficulty ×${closePreview(epoch.target, nowSec - epoch.openedAt, rules).toFixed(2)}`,
            },
            {
              label: 'escape hatch',
              value:
                escapeHatchIn(epoch.openedAt, rules.T_MAX, nowSec) > 0n
                  ? `in ${duration(Number(escapeHatchIn(epoch.openedAt, rules.T_MAX, nowSec)))}`
                  : 'open',
            },
          ]}
        />
      ) : (
        <TileHeader>epoch</TileHeader>
      )}
      <span className="sr-only" data-testid="epoch">
        {epoch?.epoch.toString() ?? ''}
      </span>
      <PowerSlider
        cores={cores()}
        threads={threads}
        onChange={setThreads}
        disabled={native}
        readout={miner.phase === 'mining' ? `${proofsPerMinute(miner.recent).toFixed(1)} / min` : undefined}
      />
      <p className="text-xs text-ink-2" data-testid="power-caption">
        {native
          ? 'Presto’s speed setting in its app decides the threads; this slider applies when proving in the browser.'
          : `${cores()} cores, one stays with the page. A change applies at the next proof; the rate readout follows within a minute.${boot.phase === 'ready' ? ` Prover started with ${boot.threads} threads.` : ''}`}
      </p>
    </Tile>
  );
}
