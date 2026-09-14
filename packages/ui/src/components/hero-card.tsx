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

/** One moment's card: what is so, what it means, its trail, and on the right the one thing to do. */
export function HeroCard({
  eyebrow,
  title,
  children,
  trail,
  side,
  tone = 'uv',
  className,
  ...props
}: Omit<React.ComponentProps<'section'>, 'title'> & {
  eyebrow: React.ReactNode;
  title: React.ReactNode;
  trail?: readonly TrailItem[];
  side?: React.ReactNode;
  tone?: HeroTone;
}) {
  return (
    <section
      data-slot="hero-card"
      data-tone={tone}
      className={cn(
        'grid items-start gap-x-7 gap-y-[18px] rounded-[10px] border bg-raised px-6 py-[22px] md:grid-cols-[minmax(0,1fr)_auto]',
        BORDER[tone],
        className,
      )}
      {...props}
    >
      <div className="min-w-0">
        <span className="label-mono">{eyebrow}</span>
        <h2 className="mt-1.5 text-balance text-[24px] font-semibold leading-[1.15] tracking-[-0.02em]">
          {title}
        </h2>
        <div className="mt-2 max-w-[70ch] text-pretty text-sm leading-[1.55] text-ink-2 [&_b]:font-medium [&_b]:text-ink">
          {children}
        </div>
        {trail && trail.length > 0 && <Trail items={trail} className="mt-3.5" />}
      </div>
      {side !== undefined && (
        <div
          data-slot="hero-side"
          className="flex min-w-0 flex-col items-start gap-2.5 md:min-w-[240px] md:max-w-[380px] md:items-end md:text-right"
        >
          {side}
        </div>
      )}
    </section>
  );
}
