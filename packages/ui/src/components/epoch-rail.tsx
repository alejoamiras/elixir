import type * as React from 'react';
import { cn } from '../lib/cn.ts';
import { Button } from './button.tsx';
import { KvRow } from './tile.tsx';

export interface EpochRailProps {
  epoch: number;
  /** Claims so far and the epoch's size; `mine` marks the claim indices (0-based) that were this key's. */
  claims: number;
  n: number;
  mine?: readonly number[];
  /** Elapsed / expected, uncapped; the tick sits at 1. */
  progress: number;
  rows: readonly { label: React.ReactNode; value: React.ReactNode }[];
  /** Seconds until the escape hatch opens; ≤ 0 shows "Close the epoch". */
  hatchSeconds: number;
  onClose?: () => void;
  closing?: boolean;
  className?: string;
}

export function EpochRail({
  epoch,
  claims,
  n,
  mine = [],
  progress,
  rows,
  hatchSeconds,
  onClose,
  closing,
  className,
}: EpochRailProps) {
  const timeline = Math.min(1, progress / 1.25);
  return (
    <div data-slot="epoch-rail" className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">epoch {epoch}</span>
        <span className="font-mono text-xs text-ink-2">
          {claims} of {n} claims
        </span>
      </div>
      <div className="flex gap-1" role="img" aria-label={`${claims} of ${n} claims`}>
        {Array.from({ length: n }, (_, i) => (
          <span
            key={i.toString()}
            data-slot="segment"
            data-filled={i < claims ? '' : undefined}
            data-mine={mine.includes(i) ? '' : undefined}
            className={cn(
              'h-1.5 flex-1 rounded-[2px]',
              i >= claims ? 'bg-panel-2' : mine.includes(i) ? 'bg-uv-2' : 'bg-uv/55',
            )}
          />
        ))}
      </div>
      <div className="relative h-1 rounded-full bg-panel-2" aria-hidden>
        <span
          data-slot="elapsed"
          className={cn('absolute inset-y-0 left-0 rounded-full', progress > 1 ? 'bg-warn' : 'bg-ink-3')}
          style={{ width: `${timeline * 100}%` }}
        />
        <span
          data-slot="expected-tick"
          className="absolute -top-0.5 h-2 w-px bg-ink"
          style={{ left: `${(1 / 1.25) * 100}%` }}
          title="expected close"
        />
      </div>
      <div>
        {rows.map((r, i) => (
          <KvRow key={i.toString()} label={r.label} value={r.value} />
        ))}
      </div>
      {hatchSeconds <= 0 && onClose && (
        <Button variant="uv" size="sm" onClick={onClose} disabled={closing} data-slot="close-epoch">
          {closing ? 'Closing…' : 'Close the epoch'}
        </Button>
      )}
    </div>
  );
}
