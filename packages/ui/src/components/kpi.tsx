import type * as React from 'react';
import { cn } from '../lib/cn.ts';

export function Kpi({
  label,
  value,
  unit,
  sub,
  size = 'md',
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  unit?: React.ReactNode;
  sub?: React.ReactNode;
  size?: 'md' | 'lg';
  className?: string;
}) {
  return (
    <div data-slot="kpi" className={cn('flex min-w-0 flex-col gap-1', className)}>
      <span className="label-mono">{label}</span>
      <span
        className={cn(
          'font-semibold tracking-[-0.02em]',
          size === 'lg' ? 'text-3xl tracking-[-0.03em]' : 'text-xl',
        )}
      >
        {value}
        {unit !== undefined && (
          <span className="ml-1.5 text-[0.45em] font-medium tracking-normal text-ink-2">{unit}</span>
        )}
      </span>
      {sub !== undefined && <span className="text-xs text-ink-2">{sub}</span>}
    </div>
  );
}
