import { ArrowDownIcon, ArrowRightIcon, ArrowUpIcon } from 'lucide-react';
import type * as React from 'react';
import { useState } from 'react';
import type { RowAction, RowKind, RowLine } from '../bridge-types.ts';
import { cn } from '../lib/cn.ts';
import { Button } from './button.tsx';
import { Progress } from './progress.tsx';
import { StatusChip } from './status-chip.tsx';
import { Trail } from './trail.tsx';

/** The bar of work under way on this page, when the line carries one and the row is open. */
function RowProgress({ value, collapsed }: { value: number | undefined; collapsed: boolean }) {
  if (value === undefined || collapsed) return null;
  return <Progress value={value * 100} className="col-span-full" data-testid="row-progress" />;
}

const KIND_ICON = { in: ArrowDownIcon, out: ArrowUpIcon, ahead: ArrowRightIcon } as const;

/** Which way the money moves, as seen from this balance: the first thing the row says. */
function KindIcon({ kind }: { kind: RowKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span
      aria-hidden
      data-slot="row-kind"
      data-kind={kind}
      className={cn(
        'inline-flex size-[30px] items-center justify-center rounded-[7px] border',
        kind === 'in' ? 'border-ok/40 text-ok' : 'border-line-2 text-ink-2',
      )}
    >
      <Icon className="size-[15px]" strokeWidth={1.8} />
    </span>
  );
}

export interface ActivityRowProps extends Omit<React.ComponentProps<'li'>, 'children' | 'onClick' | 'title'> {
  kind: RowKind;
  /** The kind in words: "From Ethereum", "To Ethereum", "Sent ahead to V6". */
  title: React.ReactNode;
  /** Small mono under the title: the other party when one is known, and when. */
  meta: React.ReactNode;
  /** The amount as this balance sees it: "+2 tYACA", "−25 tYACA". */
  signed: React.ReactNode;
  line: RowLine;
  onAction?: (kind: RowAction) => void;
  /** What Details opens: the links, the deadline, the recovery file. */
  details?: React.ReactNode;
  /** The last thing that failed on this crossing, beside its action until it succeeds. */
  error?: string;
  /** A row past its week: the sentence, the trail and Details are folded away. */
  collapsed?: boolean;
}

/** What the row leads with: the kind and whom it is with on the left, the signed amount and its word on the right. */
function RowHead({
  kind,
  title,
  meta,
  signed,
  chip,
}: Pick<ActivityRowProps, 'kind' | 'title' | 'meta' | 'signed'> & { chip: RowLine['chip'] }) {
  return (
    <>
      <KindIcon kind={kind} />
      <div className="min-w-0">
        <p className="m-0 text-[15px] font-semibold leading-[1.2] tracking-[-0.01em]" data-testid="row-title">
          {title}
        </p>
        <p className="mt-[3px] font-mono text-2xs text-ink-3">{meta}</p>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span
          className={cn(
            'whitespace-nowrap text-[15px] font-semibold leading-[1.2] tracking-[-0.01em] tabular-nums',
            kind === 'in' && 'text-ok',
          )}
          data-testid="row-amount"
        >
          {signed}
        </span>
        <StatusChip tone={chip.tone} data-testid="crossing-word">
          {chip.word}
        </StatusChip>
      </div>
    </>
  );
}

/** One crossing, the same shape whichever way it crosses. */
export function ActivityRow({
  kind,
  title,
  meta,
  signed,
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
        'grid grid-cols-[30px_1fr_auto] items-start gap-x-3.5 gap-y-2 rounded-[8px] border bg-raised px-3.5 py-3',
        needsUser ? 'border-uv' : 'border-line',
        className,
      )}
      {...props}
    >
      <RowHead kind={kind} title={title} meta={meta} signed={signed} chip={line.chip} />
      {!collapsed && (
        <p
          className="col-span-full m-0 text-pretty text-[13px] leading-[1.45] text-ink-2"
          data-testid="row-line"
        >
          {line.sentence}
        </p>
      )}
      <RowProgress value={line.progress} collapsed={collapsed} />
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
