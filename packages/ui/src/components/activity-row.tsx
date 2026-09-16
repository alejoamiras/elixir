import type * as React from 'react';
import { useState } from 'react';
import type { RowAction, RowLine } from '../bridge-types.ts';
import { cn } from '../lib/cn.ts';
import { Button } from './button.tsx';
import { StatusChip } from './status-chip.tsx';
import { Trail } from './trail.tsx';

export interface ActivityRowProps extends Omit<React.ComponentProps<'li'>, 'children' | 'onClick'> {
  amount: React.ReactNode;
  unit: React.ReactNode;
  /** Where it goes and with whom: "→ Ethereum · 0x90F7…b906", in small mono beside the amount. */
  direction: React.ReactNode;
  when: React.ReactNode;
  line: RowLine;
  onAction?: (kind: RowAction) => void;
  /** What Details opens: the links, the deadline, the recovery file. */
  details?: React.ReactNode;
  /** The last thing that failed on this crossing, beside its action until it succeeds. */
  error?: string;
  /** A row past its week: the sentence, the trail and Details are folded away. */
  collapsed?: boolean;
}

/**
 * One crossing, the same shape whichever way it crosses: the amount and where it goes, its state
 * chip and the time, one sentence, the stations, and the single action it offers. The row renders
 * what `line` says and nothing else — every word and every refusal is decided before it gets here.
 */
export function ActivityRow({
  amount,
  unit,
  direction,
  when,
  line,
  onAction,
  details,
  error,
  collapsed = false,
  className,
  ...props
}: ActivityRowProps) {
  const [open, setOpen] = useState(false);
  const act = line.action;
  const needsUser = line.chip.tone === 'ok';
  return (
    <li
      data-slot="activity-row"
      data-state={line.chip.tone}
      className={cn(
        'grid grid-cols-[1fr_auto] items-start gap-x-4 gap-y-2 rounded-[8px] border bg-raised px-3.5 py-3',
        needsUser ? 'border-uv' : 'border-line',
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <p className="m-0 text-[15px] font-semibold leading-[1.2] tracking-[-0.01em]">
          {amount}{' '}
          <small className="font-mono text-xs font-normal tracking-normal text-ink-3">
            {unit} {direction}
          </small>
        </p>
        {!collapsed && (
          <p className="mt-0.5 text-pretty text-[13px] leading-[1.45] text-ink-2" data-testid="row-line">
            {line.sentence}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <StatusChip tone={line.chip.tone} data-testid="crossing-word">
          {line.chip.word}
        </StatusChip>
        <span className="whitespace-nowrap font-mono text-2xs text-ink-3">{when}</span>
      </div>
      {!collapsed && line.trail.length > 0 && (
        <Trail items={line.trail} variant="inline" className="col-span-full mt-0.5" />
      )}
      {(act || line.also || line.note || error || details) && !collapsed && (
        <div className="col-span-full mt-0.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-line pt-2.5 text-[13px] text-ink-2">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            {act && (
              <Button
                size="sm"
                variant={needsUser ? 'uv' : 'outline'}
                disabled={act.disabled !== undefined}
                onClick={() => onAction?.(act.kind)}
                data-testid={`row-${act.kind}`}
              >
                {act.label}
              </Button>
            )}
            {act?.disabled !== undefined && (
              <span className="text-xs text-ink-3" data-testid="row-disabled">
                {act.disabled}
              </span>
            )}
            {(line.also || line.note) && (
              <span className="text-xs text-ink-3">
                {line.also && (
                  <Button
                    variant="link"
                    className="text-xs text-uv-2"
                    onClick={() => onAction?.(line.also?.kind as RowAction)}
                    data-testid={`row-${line.also.kind}`}
                  >
                    {line.also.label}
                  </Button>
                )}
                {line.also && line.note && ' '}
                {line.note}
              </span>
            )}
            {error !== undefined && (
              <span className="text-xs text-warn" data-testid="row-error">
                {error}
              </span>
            )}
          </span>
          {details !== undefined && (
            <Button
              size="sm"
              variant="link"
              className="font-mono text-2xs text-ink-3"
              aria-expanded={open}
              onClick={() => setOpen((o) => !o)}
              data-testid="row-details"
            >
              Details
            </Button>
          )}
        </div>
      )}
      {open && !collapsed && (
        <div
          className="col-span-full flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-2xs text-ink-3 [&_a]:text-uv-2"
          data-testid="row-details-open"
        >
          {details}
        </div>
      )}
    </li>
  );
}
