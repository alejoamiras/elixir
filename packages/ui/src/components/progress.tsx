import { Progress as ProgressPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

function Progress({
  className,
  value,
  indeterminate,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root> & { indeterminate?: boolean }) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      data-indeterminate={indeterminate || undefined}
      className={cn(
        'relative flex h-1 w-full items-center overflow-x-hidden rounded-full bg-panel-2',
        className,
      )}
      value={indeterminate ? null : value}
      {...props}
    >
      {indeterminate ? (
        // A step whose fraction is unknown (notes and balance): a stripe crossing its slice, still
        // under reduced motion (a static half), never a fake percentage.
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="h-full w-2/5 rounded-full bg-uv motion-safe:animate-[progress-slide_1.2s_ease-in-out_infinite] motion-reduce:w-1/2"
        />
      ) : (
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className="size-full flex-1 bg-uv transition-transform duration-200 motion-reduce:transition-none"
          style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
        />
      )}
    </ProgressPrimitive.Root>
  );
}

export { Progress };
