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

/**
 * Whether a step's paragraph is drawn: the step that is running, failed or warned speaks, and a
 * finished last step keeps its line (it is the flow's outcome). `explain` is an all-pending list
 * read as a description, where every step speaks.
 */
export const showsDetail = (step: Step, i: number, steps: readonly Step[], explain: boolean): boolean =>
  explain ||
  step.state === 'active' ||
  step.state === 'failed' ||
  step.state === 'warn' ||
  (step.state === 'done' && i === steps.length - 1);

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

const rightOf = (step: Step): React.ReactNode =>
  step.right !== undefined ? step.right : step.ms !== undefined ? fmtSeconds(step.ms) : undefined;

/** The ring and, under it, the rail to the next step: a flex child, so as tall as its step at any text length. */
function Marker({ state, last }: { state: StepState; last: boolean }) {
  return (
    <span aria-hidden className="flex flex-col items-center">
      <span
        className={cn(
          'mt-px inline-flex size-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] after:content-[""]',
          RING[state],
        )}
      />
      {!last && (
        <span
          data-slot="step-rail"
          data-done={state === 'done'}
          className={cn(
            'my-1 min-h-3 w-[1.5px] flex-1 rounded-[1px]',
            state === 'done' ? 'bg-ok/50' : 'bg-line-2',
          )}
        />
      )}
    </span>
  );
}

function Bar({ progress, done }: { progress: number; done: boolean }) {
  return (
    <span
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamp01(progress) * 100)}
      className="mt-2 block h-1 overflow-hidden rounded-[2px] bg-line-2"
    >
      <span
        className={cn('block h-full rounded-[2px]', done ? 'bg-ok' : 'bg-uv')}
        style={{ width: `${clamp01(progress) * 100}%` }}
      />
    </span>
  );
}

function StepItem({ step, last, speaks }: { step: Step; last: boolean; speaks: boolean }) {
  const right = rightOf(step);
  return (
    <li
      data-slot="step"
      data-state={step.state}
      aria-current={step.state === 'active' ? 'step' : undefined}
      className="grid grid-cols-[18px_minmax(0,1fr)_fit-content(45%)] gap-x-3 text-sm"
    >
      <Marker state={step.state} last={last} />
      <span className={cn('min-w-0', !last && 'pb-4')}>
        <span className="sr-only">{step.state}: </span>
        <span className={cn('block leading-[1.35]', TITLE[step.state])}>{step.label}</span>
        {speaks && step.detail !== undefined && (
          <span className="mt-0.5 block text-[12.5px] leading-[1.45] text-ink-3 text-pretty">
            {step.detail}
          </span>
        )}
        {step.progress !== undefined && <Bar progress={step.progress} done={step.state === 'done'} />}
      </span>
      {right !== undefined && (
        <span
          data-slot="step-right"
          // Wraps: a nowrap cell is the one thing here that can push a dialog sideways.
          className={cn(
            'mt-[3px] self-start text-right font-mono text-[11.5px] [overflow-wrap:anywhere]',
            RIGHT[step.state],
          )}
        >
          {right}
        </span>
      )}
    </li>
  );
}

export function Stepper({
  steps,
  explain = false,
  className,
  ...props
}: React.ComponentProps<'ol'> & { steps: readonly Step[]; explain?: boolean }) {
  return (
    <ol data-slot="stepper" className={cn('m-0 flex list-none flex-col p-0', className)} {...props}>
      {steps.map((step, i) => (
        <StepItem
          key={step.id}
          step={step}
          last={i === steps.length - 1}
          speaks={showsDetail(step, i, steps, explain)}
        />
      ))}
    </ol>
  );
}
