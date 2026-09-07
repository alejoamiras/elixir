import type * as React from 'react';
import { cn } from '../lib/cn.ts';
import { Button } from './button.tsx';
import { KvRow, TileHeader } from './tile.tsx';

export interface EpochRailProps {
  epoch: number;
  /** Claims so far and the epoch's size; `mine` marks the claim indices (0-based) that were this key's. */
  claims: number;
  n: number;
  mine?: readonly number[];
  /** The header's right side, e.g. "opened 03:31:12". */
  aside?: React.ReactNode;
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
  aside,
  rows,
  hatchSeconds,
  onClose,
  closing,
  className,
}: EpochRailProps) {
  return (
    <div data-slot="epoch-rail" className={cn('flex flex-col gap-3', className)}>
      <TileHeader className="mb-0" aside={aside}>
        epoch {epoch}
      </TileHeader>
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
