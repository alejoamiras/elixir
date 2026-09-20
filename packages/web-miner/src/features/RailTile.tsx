import { useAtomValue } from 'jotai';
import { useState } from 'react';
import { closePreview, difficulty, escapeHatchIn, proofsPerMinute } from '../../../miner-core/src/metrics.ts';
import { cn, EpochRail, ExternalLink, PowerSlider, Tile, TileHeader } from '../../../ui/src/index.ts';
import type { MinerController } from '../controller';
import { duration } from '../lib/format';
import { PRESTO_SITE, prestoAtom, prestoSticky } from '../presto';
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

/** The power row while Presto is the prover the Worker built: its name, where it proves, and its site. */
function PrestoRow() {
  return (
    <div
      className="flex items-center gap-3 rounded-[8px] border border-uv/40 bg-uv-dim px-3 py-2.5"
      data-testid="presto-row"
    >
      <span
        aria-hidden
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-[7px] bg-uv text-[15px] font-bold text-uv-ink"
      >
        ✦
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13.5px] font-semibold text-ink">Presto · native prover</span>
        <span className="text-xs text-ink-2">
          proving on this machine ·{' '}
          <ExternalLink href={PRESTO_SITE} className="font-sans text-uv-2">
            About Presto
          </ExternalLink>
        </span>
      </span>
    </div>
  );
}

/** The slider and its line; a change is stored and applied at the next browser build (`reconfigure`). */
function PowerRow({ controller }: { controller: () => MinerController | undefined }) {
  const miner = useAtomValue(minerAtom);
  const boot = useAtomValue(bootAtom);
  const [settings, setSettings] = useSettings();
  const threads = settings.threads ?? Math.max(1, cores() - 1);
  const setThreads = (t: number) => {
    setSettings({ threads: t });
    controller()?.reconfigure(t);
  };
  return (
    <>
      <PowerSlider
        cores={cores()}
        threads={threads}
        onChange={setThreads}
        readout={miner.phase === 'mining' ? `${proofsPerMinute(miner.recent).toFixed(1)} / min` : undefined}
      />
      <p className="text-xs text-ink-2" data-testid="power-caption">
        {cores()} cores, one stays with the page. A change applies at the next proof; the rate readout follows
        within a minute.{boot.phase === 'ready' ? ` Prover started with ${boot.threads} threads.` : ''}
      </p>
    </>
  );
}

function EpochTile({ controller }: { controller: () => MinerController | undefined }) {
  const epoch = useAtomValue(epochAtom);
  const rules = useAtomValue(rulesAtom);
  const now = useAtomValue(nowAtom);
  const claims = useAtomValue(claimsAtom);
  const [closing, setClosing] = useState(false);
  // The row ↔ slider swap follows the prover the Worker settled on, never one refused proof (the pill's ✦ does).
  const native = prestoSticky(useAtomValue(prestoAtom));
  const nowSec = BigInt(Math.floor(now / 1000));
  const hatch = epoch && rules ? escapeHatchIn(epoch.openedAt, rules.T_MAX, nowSec) : 0n;
  return (
    <Tile className="flex flex-col gap-5">
      {epoch && rules ? (
        <EpochRail
          epoch={Number(epoch.epoch)}
          claims={epoch.claims}
          n={rules.N}
          mine={claims.filter((c) => c.epoch === epoch.epoch).map((_, i) => i)}
          aside={`opened ${new Date(Number(epoch.openedAt) * 1000).toISOString().slice(11, 19)}`}
          hatchSeconds={Number(hatch)}
          closing={closing}
          onClose={() => {
            setClosing(true);
            void controller()
              ?.roll()
              .finally(() => setClosing(false));
          }}
          rows={[
            {
              label: 'wins',
              value: (
                <span data-testid="epoch-claims">
                  {epoch.claims} of {rules.N}
                </span>
              ),
            },
            { label: 'bar', value: difficulty(epoch.target).toFixed(1) },
            { label: 'open for', value: duration(Math.max(0, Number(nowSec - epoch.openedAt))) },
            { label: 'expected close', value: duration(Number(rules.EXPECTED_EPOCH_SECONDS)) },
            {
              label: 'next bar if it closed now',
              value: `×${closePreview(epoch.target, nowSec - epoch.openedAt, rules).toFixed(2)}`,
            },
            { label: 'anyone can close it', value: hatch > 0n ? `in ${duration(Number(hatch))}` : 'now' },
          ]}
        />
      ) : (
        <TileHeader>epoch</TileHeader>
      )}
      <span className="sr-only" data-testid="epoch">
        {epoch?.epoch.toString() ?? ''}
      </span>
      {native ? <PrestoRow /> : <PowerRow controller={controller} />}
    </Tile>
  );
}
