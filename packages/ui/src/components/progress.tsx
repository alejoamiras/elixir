import { Progress as ProgressPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/**
 * `indeterminate` keeps the finished fill (`value`) and moves a stripe only inside the slice after it
 * — `indeterminateSpan` percent wide (the rest of the track by default) — so a step whose fraction is
 * unknown never reads as a fake percentage; under reduced motion the stripe is a static half of it.
 */
function Progress({
  className,
  value,
  indeterminate,
  indeterminateSpan,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & {
  indeterminate?: boolean;
  indeterminateSpan?: number;
}) {
  const done = value ?? 0;
  const span = indeterminateSpan ?? 100 - done;
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-indeterminate={indeterminate || undefined}
      className={cn(
        'relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-panel-2',
        className,
      )}
      value={value}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="size-full flex-1 bg-uv transition-transform duration-200 motion-reduce:transition-none"
        style={{ transform: `translateX(-${100 - done}%)` }}
      />
      {indeterminate && (
        <span
          aria-hidden
          data-slot="progress-stripe"
          className="absolute inset-y-0 overflow-hidden"
          style={{ left: `${done}%`, width: `${span}%` }}
        >
          <span className="block h-full w-1/2 bg-uv/70 motion-safe:animate-[progress-slide_1.2s_ease-in-out_infinite]" />
        </span>
      )}
    </ProgressPrimitive.Root>
  );
}

export { Progress };
