import type * as React from 'react';
import { cn } from '../lib/cn.ts';

export type Status = 'idle' | 'mining' | 'claiming' | 'minted' | 'not-backed-up' | 'paused';

const LABEL: Record<Status, string> = {
  idle: 'idle',
  mining: 'mining',
  claiming: 'claiming',
  minted: 'minted',
  'not-backed-up': 'not backed up',
  paused: 'paused',
};

const TONE: Record<Status, string> = {
  idle: 'border-line-2 text-ink-2 [&>i]:bg-ink-3',
  mining: 'border-uv/60 text-uv-2 [&>i]:bg-uv [&>i]:animate-pulse [&>i]:motion-reduce:animate-none',
  claiming: 'border-uv/60 text-uv-2 [&>i]:bg-uv',
  minted: 'border-ok/50 text-ok [&>i]:bg-ok',
  'not-backed-up': 'border-warn/50 text-warn [&>i]:bg-warn',
  paused: 'border-bad/50 text-bad [&>i]:bg-bad',
};

/** One pill per screen, top right; the 5 px square is the state light the favicon mirrors. */
export function StatusPill({
  status,
  children,
  className,
  ...props
}: React.ComponentProps<'span'> & { status: Status }) {
  return (
    <span
      data-slot="status-pill"
      data-status={status}
      className={cn(
        'inline-flex items-center gap-2 rounded-[5px] border px-2.5 py-1.5 font-mono text-2xs font-medium tracking-[0.06em] uppercase',
        TONE[status],
        className,
      )}
      {...props}
    >
      <i aria-hidden className="inline-block size-[5px] shrink-0" />
      {children ?? LABEL[status]}
    </span>
  );
}
