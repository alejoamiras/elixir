import type * as React from 'react';
import { cn } from '../lib/cn.ts';
import { Trail, type TrailItem } from './trail.tsx';

export type JournalTone = 'neutral' | 'on' | 'ok' | 'bad' | 'warn';

const BORDER: Record<JournalTone, string> = {
  neutral: 'border-line-2',
  on: 'border-uv',
  ok: 'border-ok/40',
  bad: 'border-bad/50',
  warn: 'border-warn/45',
};

/**
 * One crossing in the wallet's journal: the amount and where it goes, when it started, its
 * stations, one line on where it is now, and the links or actions it offers. The border is the
 * crossing's tone: `on` while it moves, `ok` once landed, `bad` once lost, `warn` for an exception.
 */
export function JournalCard({
  amount,
  unit,
  who,
  when,
  trail,
  line,
  actions,
  tone = 'neutral',
  className,
  ...props
}: Omit<React.ComponentProps<'li'>, 'children'> & {
  amount: React.ReactNode;
  unit: React.ReactNode;
  who: React.ReactNode;
  when?: React.ReactNode;
  trail: readonly TrailItem[];
  line: React.ReactNode;
  actions?: React.ReactNode;
  tone?: JournalTone;
}) {
  return (
    <li
      data-slot="journal-card"
      data-tone={tone}
      className={cn(
        'flex flex-col gap-2 rounded-[8px] border bg-raised px-3.5 py-3',
        BORDER[tone],
        className,
      )}
      {...props}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0">
          <span className="whitespace-nowrap font-mono text-[19px] font-semibold leading-[1.1] tracking-[-0.02em]">
            {amount}
            <small className="ml-1 font-mono text-xs font-normal text-ink-3">{unit}</small>
          </span>{' '}
          <span className="font-mono text-xs text-ink-2">{who}</span>
        </span>
        {when !== undefined && (
          <span className="whitespace-nowrap font-mono text-2xs text-ink-3">{when}</span>
        )}
      </div>
      <Trail items={trail} variant="inline" />
      <p className="text-pretty text-[12.5px] leading-[1.45] text-ink-2 [&_b]:font-medium [&_b]:text-ink">
        {line}
      </p>
      {actions !== undefined && (
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-xs [&_a]:text-uv-2">
          {actions}
        </div>
      )}
    </li>
  );
}
