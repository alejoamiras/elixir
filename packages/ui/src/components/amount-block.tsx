import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/**
 * The big figure of a sheet: the amount in mono, its unit small, and on the right what the sheet
 * offers or reports (a "max" chip, "all · 48.00", "✓ burned in block 73,240"). `tone` is the
 * border: `strong` for the figure being edited, `quiet` once it is settled, `ok` once it is done.
 */
export function AmountBlock({
  value,
  unit,
  aside,
  tone = 'strong',
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
  value: React.ReactNode;
  unit: React.ReactNode;
  aside?: React.ReactNode;
  tone?: 'strong' | 'quiet' | 'ok';
}) {
  return (
    <div
      data-slot="amount"
      data-tone={tone}
      className={cn(
        'flex items-center justify-between gap-3 rounded-[8px] border px-4 py-3.5 font-mono text-[36px] font-semibold leading-none tracking-[-0.02em]',
        tone === 'strong' && 'border-line-2',
        tone === 'quiet' && 'border-line',
        tone === 'ok' && 'border-ok/40',
        className,
      )}
      {...props}
    >
      <span className="min-w-0 truncate">
        {value} <small className="font-mono text-[13px] font-normal text-ink-3">{unit}</small>
      </span>
      {aside !== undefined && (
        <span className="shrink-0 font-mono text-2xs font-normal tracking-normal text-ink-3">{aside}</span>
      )}
    </div>
  );
}

/** The "max" chip of an amount block: uppercase mono, the accent's border. */
export function MaxChip({ className, children = 'max', ...props }: React.ComponentProps<'button'>) {
  return (
    <button
      type="button"
      data-slot="max"
      className={cn(
        'rounded-sm border border-uv px-2 py-1 font-mono text-2xs font-medium uppercase tracking-[0.06em] text-uv-2 hover:bg-uv-dim',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
