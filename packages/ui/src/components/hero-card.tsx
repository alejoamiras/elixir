import type * as React from 'react';
import { cn } from '../lib/cn.ts';
import { Trail, type TrailItem } from './trail.tsx';

export type HeroTone = 'uv' | 'ok' | 'warn' | 'bad';

const BORDER: Record<HeroTone, string> = {
  uv: 'border-uv',
  ok: 'border-ok/50',
  warn: 'border-warn',
  bad: 'border-bad',
};

/** One moment's card; `aside` sits across from the eyebrow, `actions` under the body and trail. */
export function HeroCard({
  eyebrow,
  aside,
  title,
  children,
  trail,
  actions,
  tone = 'uv',
  className,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  eyebrow: React.ReactNode;
  aside?: React.ReactNode;
  title: React.ReactNode;
  trail?: readonly TrailItem[];
  actions?: React.ReactNode;
  tone?: HeroTone;
}) {
  return (
    <section
      data-slot="hero-card"
      data-tone={tone}
      className={cn('rounded-[10px] border bg-raised px-6 py-[22px]', BORDER[tone], className)}
      {...props}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <span className="label-mono">{eyebrow}</span>
          {aside}
        </div>
        <h2 className="mt-1.5 text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em]">
          {title}
        </h2>
        <div className="mt-2 max-w-[70ch] text-pretty text-sm leading-[1.55] text-ink-2 [&_b]:font-medium [&_b]:text-ink">
          {children}
        </div>
        {trail && trail.length > 0 && <Trail items={trail} className="mt-3.5" />}
        {actions !== undefined && (
          <div data-slot="hero-actions" className="mt-4 flex flex-wrap items-center gap-3.5">
            {actions}
          </div>
        )}
      </div>
    </section>
  );
}
