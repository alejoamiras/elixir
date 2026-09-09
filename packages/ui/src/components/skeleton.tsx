import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/**
 * A shape that is loading, at the size of what will replace it: a 90° `panel → panel-2 → panel`
 * gradient sliding across it (still under reduced motion). `quiet` is the same box with nothing in
 * it — the geometry without the noise, for a beat that has not yet been late.
 */
export function Skeleton({ className, quiet, ...props }: React.ComponentProps<'div'> & { quiet?: boolean }) {
  return (
    <div
      data-slot="skeleton"
      data-quiet={quiet || undefined}
      aria-hidden
      className={cn(
        'rounded-[3px]',
        quiet
          ? 'bg-transparent'
          : 'bg-[linear-gradient(90deg,var(--panel),var(--panel-2),var(--panel))] bg-[length:200%_100%] motion-safe:animate-[skeleton-shimmer_1.6s_ease-in-out_infinite] motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
