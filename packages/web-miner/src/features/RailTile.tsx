import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { closePreview, difficulty, escapeHatchIn, proofsPerMinute } from '../../../miner-core/src/metrics.ts';
import { EpochRail, PowerSlider, Tile, TileHeader } from '../../../ui/src/index.ts';
import type { MinerController } from '../controller';
import { duration } from '../lib/format';
import { useSettings } from '../settings';
import { bootAtom, claimsAtom, epochAtom, minerAtom, nowAtom, rulesAtom } from '../state';

const cores = () => navigator.hardwareConcurrency || 2;

export function RailTile({ controller }: { controller: () => MinerController | undefined }) {
  const epoch = useAtomValue(epochAtom);
  const rules = useAtomValue(rulesAtom);
  const now = useAtomValue(nowAtom);
  const miner = useAtomValue(minerAtom);
  const boot = useAtomValue(bootAtom);
  const claims = useAtomValue(claimsAtom);
  const [settings, setSettings] = useSettings();
  const [closing, setClosing] = useState(false);
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
          progress={Number(nowSec - epoch.openedAt) / Number(rules.EXPECTED_EPOCH_SECONDS)}
          hatchSeconds={Number(escapeHatchIn(epoch.openedAt, rules.T_MAX, nowSec))}
          closing={closing}
          onClose={() => {
            setClosing(true);
            void controller()
              ?.roll()
              .finally(() => setClosing(false));
          }}
          rows={[
            { label: 'opened', value: new Date(Number(epoch.openedAt) * 1000).toISOString().slice(11, 19) },
            {
              label: 'claims',
              value: (
                <span data-testid="epoch-claims">
                  {epoch.claims} of {rules.N}
                </span>
              ),
            },
            { label: 'difficulty', value: difficulty(epoch.target).toFixed(1) },
            { label: 'open for', value: duration(Number(nowSec - epoch.openedAt)) },
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
        readout={miner.phase === 'mining' ? `${proofsPerMinute(miner.recent).toFixed(1)} / min` : undefined}
      />
      <p className="text-xs text-ink-2">
        {cores()} cores, one stays with the page. A change applies at the next proof; the rate readout follows
        within a minute.
        {boot.phase === 'ready' && ` Prover started with ${boot.threads} threads.`}
      </p>
    </Tile>
  );
}
