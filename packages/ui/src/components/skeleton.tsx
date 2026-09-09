import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/** A loading shape at the size of what replaces it. `quiet` keeps the geometry and drops the shimmer: for a beat not yet late. */
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
