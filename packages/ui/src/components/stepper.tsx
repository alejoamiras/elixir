import type * as React from 'react';
import { cn } from '../lib/cn.ts';

export type StepState = 'pending' | 'active' | 'done' | 'failed' | 'warn';

export interface Step {
  id: string;
  label: React.ReactNode;
  state: StepState;
  /** Measured time for done steps; the running elapsed for the active one. */
  ms?: number;
  /** Second line, e.g. a TTL countdown. */
  detail?: React.ReactNode;
  /** The mono right column when it is not a time (a byte count); wins over `ms`. */
  right?: React.ReactNode;
}

const TEXT: Record<StepState, string> = {
  pending: 'text-ink-4',
  active: 'text-ink',
  done: 'text-ink-2',
  failed: 'text-bad',
  warn: 'text-warn',
};

const DOT: Record<StepState, string> = {
  pending: 'bg-ink-4',
  active: 'bg-uv',
  done: 'bg-ok',
  failed: 'bg-bad',
  warn: 'bg-warn',
};

export const fmtSeconds = (ms: number): string =>
  ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`;

export function Stepper({
  steps,
  className,
  ...props
}: React.ComponentProps<'ol'> & { steps: readonly Step[] }) {
  return (
    <ol data-slot="stepper" className={cn('m-0 flex list-none flex-col gap-1.5 p-0', className)} {...props}>
      {steps.map((step) => (
        <li
          key={step.id}
          data-slot="step"
          data-state={step.state}
          aria-current={step.state === 'active' ? 'step' : undefined}
          className={cn('flex items-baseline gap-3 text-sm', TEXT[step.state])}
        >
          <span
            aria-hidden
            className={cn('inline-block size-[5px] shrink-0 translate-y-[-1px]', DOT[step.state])}
          />
          <span className="min-w-0 flex-1">
            <span className="sr-only">{step.state}: </span>
            <span>{step.label}</span>
            {step.detail !== undefined && <span className="block text-xs text-ink-2">{step.detail}</span>}
          </span>
          {step.right !== undefined ? (
            <span className="font-mono text-xs text-ink-2">{step.right}</span>
          ) : (
            step.ms !== undefined && (
              <span className="font-mono text-xs text-ink-2">{fmtSeconds(step.ms)}</span>
            )
          )}
        </li>
      ))}
    </ol>
  );
}
