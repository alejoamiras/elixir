import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/** A shape that is loading: the size of what will replace it, pulsing (still under reduced motion). */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden
      className={cn('animate-pulse rounded-md bg-panel-2 motion-reduce:animate-none', className)}
      {...props}
    />
  );
}
