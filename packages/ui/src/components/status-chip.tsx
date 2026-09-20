import type * as React from 'react';
import type { ChipTone } from '../bridge-types.ts';
import { cn } from '../lib/cn.ts';

export type { ChipTone };

const TONE: Record<ChipTone, string> = {
  ok: 'border-ok/45 text-ok [&>i]:bg-ok',
  on: 'border-uv/60 text-uv-2 [&>i]:bg-uv',
  warn: 'border-warn/50 text-warn [&>i]:bg-warn',
  bad: 'border-bad/50 text-bad [&>i]:bg-bad',
  dim: 'border-line text-ink-3 [&>i]:bg-ink-4',
  done: 'border-line text-ink-3',
};

/** A state in mono with its light — never a button; `done` carries a ✓ in place of the light. */
export function StatusChip({
  tone,
  className,
  children,
  ...props
}: React.ComponentProps<'span'> & { tone: ChipTone }) {
  return (
    <span
      data-slot="status-chip"
      data-tone={tone}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-sm border px-[9px] py-1 font-mono text-[11px] font-medium leading-[1.3] tracking-[0.04em]',
        TONE[tone],
        className,
      )}
      {...props}
    >
      {tone === 'done' ? (
        <span aria-hidden>✓ </span>
      ) : (
        <i aria-hidden className="inline-block size-[5px] shrink-0" />
      )}
      {children}
    </span>
  );
}
