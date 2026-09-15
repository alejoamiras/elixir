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
  /** 0..1: the determinate bar under the title, only where bytes or blocks are known. */
  progress?: number;
}

const TITLE: Record<StepState, string> = {
  pending: 'font-normal text-ink-2',
  active: 'font-medium text-ink',
  done: 'font-medium text-ink-2',
  failed: 'font-medium text-bad',
  warn: 'font-medium text-warn',
};

const RING: Record<StepState, string> = {
  pending: 'border-line-2',
  active: 'border-uv shadow-[0_0_0_3px_var(--uv-dim)] after:size-[7px] after:rounded-full after:bg-uv',
  done: 'border-ok bg-ok after:-mt-0.5 after:h-1 after:w-2 after:-rotate-45 after:border-ground after:border-b-[1.8px] after:border-l-[1.8px]',
  failed: 'border-bad after:size-[7px] after:bg-bad',
  warn: 'border-warn after:size-[7px] after:bg-warn',
};

const RIGHT: Record<StepState, string> = {
  pending: 'text-ink-3',
  active: 'text-uv-2',
  done: 'text-ok',
  failed: 'text-bad',
  warn: 'text-warn',
};

export const fmtSeconds = (ms: number): string =>
  ms >= 60_000 ? `${(ms / 60_000).toFixed(1)} min` : `${(ms / 1000).toFixed(1)} s`;

/** Named stages down a line: a ring per stage (✓ when done, lit while active), the detail under the title, the time or link at the right. */
export function Stepper({
  steps,
  className,
  ...props
}: React.ComponentProps<'ol'> & { steps: readonly Step[] }) {
  return (
    <ol data-slot="stepper" className={cn('m-0 flex list-none flex-col p-0', className)} {...props}>
      {steps.map((step) => {
        const right =
          step.right !== undefined ? step.right : step.ms !== undefined ? fmtSeconds(step.ms) : undefined;
        return (
          <li
            key={step.id}
            data-slot="step"
            data-state={step.state}
            aria-current={step.state === 'active' ? 'step' : undefined}
            className="relative grid grid-cols-[18px_1fr_auto] items-start gap-x-3 py-2 text-sm not-last:after:absolute not-last:after:top-[27px] not-last:after:left-[7.5px] not-last:after:h-[22px] not-last:after:w-[1.5px] not-last:after:bg-line"
          >
            <span
              aria-hidden
              className={cn(
                'mt-px inline-flex size-[18px] items-center justify-center rounded-full border-[1.5px] after:content-[""]',
                RING[step.state],
              )}
            />
            <span className="min-w-0">
              <span className="sr-only">{step.state}: </span>
              <span className={cn('block leading-[1.35]', TITLE[step.state])}>{step.label}</span>
              {step.detail !== undefined && (
                <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-ink-3 text-pretty">
                  {step.detail}
                </span>
              )}
              {step.progress !== undefined && (
                <span
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(Math.min(1, Math.max(0, step.progress)) * 100)}
                  className="mt-2 block h-1 overflow-hidden rounded-[2px] bg-line-2"
                >
                  <span
                    className={cn('block h-full rounded-[2px]', step.state === 'done' ? 'bg-ok' : 'bg-uv')}
                    style={{ width: `${Math.min(1, Math.max(0, step.progress)) * 100}%` }}
                  />
                </span>
              )}
            </span>
            {right !== undefined && (
              <span
                className={cn(
                  'mt-[3px] whitespace-nowrap text-right font-mono text-[11.5px]',
                  RIGHT[step.state],
                )}
              >
                {right}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
