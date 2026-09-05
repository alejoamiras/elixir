import type * as React from 'react';
import { cn } from '../lib/cn.ts';
import { fmtSeconds } from './stepper.tsx';

export interface PreflightRow {
  id: string;
  label: React.ReactNode;
  /** What was checked: a hash, a hostname and block, a thread count. */
  evidence?: React.ReactNode;
  state: 'pending' | 'running' | 'ok' | 'failed';
  ms?: number;
  /** The failure, in words: what happened, what to do next. */
  error?: React.ReactNode;
}

/** The loader is evidence, not a spinner; on failure it doubles as the diagnostics screen. */
export function Preflight({
  rows,
  action,
  className,
}: {
  rows: readonly PreflightRow[];
  /** Rendered under a failed row (retry, change node…). */
  action?: React.ReactNode;
  className?: string;
}) {
  const failed = rows.find((r) => r.state === 'failed');
  return (
    <div
      data-slot="preflight"
      data-failed={failed ? '' : undefined}
      className={cn('flex flex-col', className)}
    >
      <ol className="m-0 list-none p-0">
        {rows.map((r) => (
          <li
            key={r.id}
            data-slot="preflight-row"
            data-state={r.state}
            className={cn(
              'flex items-baseline gap-3 border-t border-line py-2 text-sm first:border-t-0',
              r.state === 'pending' && 'text-ink-4',
              r.state === 'failed' && 'text-bad',
            )}
          >
            <span
              aria-hidden
              className={cn(
                'inline-block size-[5px] shrink-0 translate-y-[-1px]',
                r.state === 'pending' && 'bg-ink-4',
                r.state === 'running' && 'bg-uv',
                r.state === 'ok' && 'bg-ok',
                r.state === 'failed' && 'bg-bad',
              )}
            />
            <span className="min-w-0 flex-1">
              <span className="text-ink">{r.label}</span>
              {r.evidence !== undefined && (
                <span className="ml-2 font-mono text-xs text-ink-3">{r.evidence}</span>
              )}
              {r.state === 'failed' && r.error !== undefined && (
                <span data-slot="preflight-error" className="mt-1 block text-xs text-bad">
                  {r.error}
                </span>
              )}
            </span>
            {r.ms !== undefined && <span className="font-mono text-xs text-ink-3">{fmtSeconds(r.ms)}</span>}
            {r.state === 'running' && <span className="font-mono text-xs text-ink-3">…</span>}
          </li>
        ))}
      </ol>
      {failed && action !== undefined && <div className="mt-3 flex gap-2">{action}</div>}
    </div>
  );
}
