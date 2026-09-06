// One block per epoch, width = duration, colour = what happened next: the retarget controller,
// visible. The open epoch is always on the right; a click selects, ← → step, the URL follows.
import { useEffect } from 'react';
import type { EpochRow } from '../../../miner-core/src/reader.ts';
import { cn } from '../../../ui/src/index.ts';

export interface StripProps {
  rows: readonly EpochRow[];
  selected: number | null;
  onSelect: (epoch: number | null) => void;
  /** Unix seconds "now" for the open epoch's width (the last block's time). */
  now: number;
  onOlder?: () => void;
}

const MIN = 6;

/** Colour by the next epoch: harder (retarget < 1) violet, easier grey, a roll amber. */
export const tone = (r: EpochRow): string => {
  if (r.duration === null) return 'bg-panel border border-uv/60';
  if (r.closedBy === 'roll') return 'bg-warn/70';
  return (r.retarget ?? 1) < 1 ? 'bg-uv/70' : 'bg-ink-3';
};

/** ← → from `current`: the neighbour's epoch, null for the open one, 'older' past the left edge. */
export function step(
  rows: readonly EpochRow[],
  current: number | null,
  dir: -1 | 1,
): number | null | 'older' {
  const i = rows.findIndex((r) => r.epoch === current);
  if (i < 0) return current;
  const j = i + dir;
  if (j < 0) return 'older';
  if (j >= rows.length - 1) return null;
  return rows[j]?.epoch ?? null;
}

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName);

export function Strip({ rows, selected, onSelect, now, onOlder }: StripProps) {
  const open = rows[rows.length - 1];
  const current = selected ?? open?.epoch ?? null;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') || typing(e.target)) return;
      e.preventDefault();
      const next = step(rows, current, e.key === 'ArrowLeft' ? -1 : 1);
      if (next === 'older') onOlder?.();
      else onSelect(next);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, current, onSelect, onOlder]);
  // Width is a flex weight (seconds, clamped), so the row shares the container; many rows scroll.
  const widths = rows.map((r) =>
    Math.max(MIN, Math.min(400, (r.duration ?? Math.max(0, now - r.openedAt)) / 6)),
  );
  const lastClosed = rows.length >= 2 ? rows[rows.length - 2] : undefined;
  return (
    <div data-testid="strip" className="flex flex-col gap-2">
      <div
        className="flex h-9 items-stretch gap-px overflow-x-auto"
        role="listbox"
        aria-label="epochs, oldest to newest"
      >
        {rows.map((r, i) => (
          <button
            type="button"
            key={r.epoch}
            role="option"
            aria-selected={r.epoch === current}
            aria-label={`epoch ${r.epoch}`}
            data-epoch={r.epoch}
            onClick={() => onSelect(r.duration === null ? null : r.epoch)}
            style={{ flexGrow: widths[i], flexBasis: 0 }}
            className={cn(
              'min-w-[6px] shrink-0 rounded-[2px] transition-[flex-grow] duration-200',
              tone(r),
              r.epoch === current && 'ring-2 ring-ink',
              r === lastClosed &&
                'motion-safe:animate-in motion-safe:slide-in-from-right-2 motion-safe:duration-[240ms]',
            )}
          />
        ))}
      </div>
      <p className="text-2xs text-ink-2">
        click an epoch · ← → to step · the open one is always on the right · the URL follows
      </p>
    </div>
  );
}
