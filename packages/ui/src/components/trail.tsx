import type * as React from 'react';
import type { TrailItem, TrailState } from '../bridge-types.ts';
import { cn } from '../lib/cn.ts';

export type { TrailItem, TrailState };

const keyOf = (it: TrailItem): string => it.id ?? (typeof it.label === 'string' ? it.label : it.state);

const COLOR: Record<TrailState, string> = {
  todo: 'text-ink-3',
  on: 'text-ink',
  done: 'text-ink-3',
  bad: 'text-bad',
  warn: 'text-warn',
};

const DOT: Record<TrailState, string> = {
  todo: 'bg-ink-4',
  on: 'bg-uv',
  done: 'bg-ok',
  bad: 'bg-bad',
  warn: 'bg-warn',
};

const CHIP_BORDER: Record<TrailState, string> = {
  todo: 'border-line',
  on: 'border-uv',
  done: 'border-line',
  bad: 'border-bad/50',
  warn: 'border-warn/45',
};

/**
 * A crossing's stations in order, `›` between them, each with its state: bordered chips under a
 * card's title (`chips`), or the bare mono row inside a journal card (`inline`). A done station
 * carries ✓ where the others carry their light.
 */
export function Trail({
  items,
  variant = 'chips',
  className,
  ...props
}: React.ComponentProps<'div'> & { items: readonly TrailItem[]; variant?: 'chips' | 'inline' }) {
  const chips = variant === 'chips';
  return (
    <div
      data-slot="trail"
      data-variant={variant}
      className={cn(
        'flex flex-wrap items-center font-mono',
        chips ? 'gap-2 text-xs text-ink-3' : 'gap-1.5 text-2xs text-ink-3',
        className,
      )}
      {...props}
    >
      {items.map((it, i) => (
        <span key={keyOf(it)} className="contents">
          {i > 0 && (
            <span aria-hidden className="text-ink-4">
              ›
            </span>
          )}
          <span
            data-state={it.state}
            className={cn(
              'inline-flex items-center gap-1.5 whitespace-nowrap',
              chips && 'rounded-[5px] border px-[9px] py-[5px]',
              chips && CHIP_BORDER[it.state],
              COLOR[it.state],
            )}
          >
            {it.state === 'done' ? (
              <span aria-hidden>✓ </span>
            ) : (
              <i aria-hidden className={cn('inline-block size-[5px] shrink-0', DOT[it.state])} />
            )}
            {it.label}
          </span>
        </span>
      ))}
    </div>
  );
}
