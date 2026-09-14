import type * as React from 'react';
import type { BarSegment } from '../bridge-types.ts';
import { cn } from '../lib/cn.ts';

export type { BarSegment };

/**
 * Where a version's coins are, as one bar split by place, with the legend under it: the bar's
 * segments scale to their sum, the legend prints each figure as given.
 */
export function StackedBar({
  segments,
  className,
  ...props
}: React.ComponentProps<'div'> & { segments: readonly BarSegment[] }) {
  const sum = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  return (
    <div data-slot="stacked-bar" className={cn('flex flex-col gap-2', className)} {...props}>
      <div
        className="flex h-3.5 gap-[2px] overflow-hidden rounded-[4px]"
        role="img"
        aria-label="where the coins are"
      >
        {segments.map((s) => (
          <i
            key={s.id}
            data-segment={s.id}
            className="block h-full"
            style={{ width: sum > 0 ? `${(100 * Math.max(0, s.value)) / sum}%` : '0%', background: s.color }}
          />
        ))}
      </div>
      <dl className="m-0 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-2xs text-ink-3">
        {segments.map((s) => (
          <div key={s.id} className="flex items-center gap-1.5">
            <i aria-hidden className="inline-block size-2 rounded-[2px]" style={{ background: s.color }} />
            <dt className="contents">{s.label}</dt>
            <dd className="m-0 font-medium text-ink">{s.figure}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
