import type * as React from 'react';
import { cn } from '../lib/cn.ts';

export type TimelineState = 'todo' | 'on' | 'done' | 'bad';

export interface TimelineItem {
  id: string;
  label: React.ReactNode;
  detail?: React.ReactNode;
  state: TimelineState;
}

const DOT: Record<TimelineState, string> = {
  todo: 'bg-ink-3',
  on: 'bg-uv',
  done: 'bg-ok',
  bad: 'bg-bad',
};

const RULE: Record<TimelineState, string> = {
  todo: 'border-line-2',
  on: 'border-uv',
  done: 'border-ok',
  bad: 'border-line-2',
};

/**
 * A life in phases, left to right: a dot on a rule per phase, its name in uppercase mono, a line
 * under it with the date or what it waits for. Done phases are green, the current one violet, the
 * rest grey. Below `md` the phases stack, the rule on their left.
 */
export function Timeline({
  items,
  className,
  ...props
}: React.ComponentProps<'ol'> & { items: readonly TimelineItem[] }) {
  return (
    <ol
      data-slot="timeline"
      className={cn('m-0 flex list-none flex-col gap-3 p-0 md:flex-row md:gap-0', className)}
      {...props}
    >
      {items.map((it) => (
        <li
          key={it.id}
          data-state={it.state}
          aria-current={it.state === 'on' ? 'step' : undefined}
          className={cn(
            'relative min-w-0 flex-1 border-l-2 pl-4 text-xs text-ink-2 md:border-l-0 md:border-t-2 md:pl-0 md:pr-2.5 md:pt-2.5',
            RULE[it.state],
          )}
        >
          <i
            aria-hidden
            className={cn(
              'absolute size-2.5 rounded-full -left-[6px] top-0 md:left-0 md:-top-[6px]',
              DOT[it.state],
            )}
          />
          <b className="mb-0.5 block font-mono text-2xs font-medium uppercase tracking-[0.06em] text-ink">
            {it.label}
          </b>
          {it.detail !== undefined && <span className="text-pretty">{it.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
