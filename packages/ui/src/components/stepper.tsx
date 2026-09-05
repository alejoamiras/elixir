import type * as React from 'react';
import { cn } from '../lib/cn.ts';

export interface Step {
  id: string;
  label: React.ReactNode;
  state: 'pending' | 'active' | 'done' | 'failed';
  /** Measured time for done steps; the running elapsed for the active one. */
  ms?: number;
  /** Second line, e.g. a TTL countdown. */
  detail?: React.ReactNode;
}

export const fmtSeconds = (ms: number): string =>
  ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`;

export function Stepper({ steps, className }: { steps: readonly Step[]; className?: string }) {
  return (
    <ol data-slot="stepper" className={cn('m-0 flex list-none flex-col gap-1.5 p-0', className)}>
      {steps.map((step) => (
        <li
          key={step.id}
          data-slot="step"
          data-state={step.state}
          aria-current={step.state === 'active' ? 'step' : undefined}
          className={cn(
            'flex items-baseline gap-3 text-sm',
            step.state === 'pending' && 'text-ink-4',
            step.state === 'active' && 'text-ink',
            step.state === 'done' && 'text-ink-2',
            step.state === 'failed' && 'text-bad',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'inline-block size-[5px] shrink-0 translate-y-[-1px]',
              step.state === 'pending' && 'bg-ink-4',
              step.state === 'active' && 'bg-uv',
              step.state === 'done' && 'bg-ok',
              step.state === 'failed' && 'bg-bad',
            )}
          />
          <span className="min-w-0 flex-1">
            <span className="sr-only">{step.state}: </span>
            <span>{step.label}</span>
            {step.detail !== undefined && <span className="block text-xs text-ink-2">{step.detail}</span>}
          </span>
          {step.ms !== undefined && (
            <span className="font-mono text-xs text-ink-2">{fmtSeconds(step.ms)}</span>
          )}
        </li>
      ))}
    </ol>
  );
}
