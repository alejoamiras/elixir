import type * as React from 'react';
import { cn } from '../lib/cn.ts';

export type NoteTone = 'neutral' | 'warn' | 'ok';

/**
 * A boxed aside inside a sheet or a card: a bold first line, then the explanation. `neutral` sits
 * on the panel ground ("If V6 never opens"); `warn` carries the amber border ("Public on Ethereum").
 */
export function Note({
  title,
  tone = 'neutral',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & { title: React.ReactNode; tone?: NoteTone }) {
  return (
    <div
      data-slot="note"
      data-tone={tone}
      className={cn(
        'flex flex-col gap-1.5 rounded-[6px] border px-3.5 py-3 text-[12.5px] leading-[1.5] text-ink-2',
        tone === 'neutral' && 'border-line bg-panel',
        tone === 'warn' && 'border-warn/45',
        tone === 'ok' && 'border-ok/40',
        className,
      )}
      {...props}
    >
      <b
        className={cn(
          'text-[13px] font-medium',
          tone === 'warn' ? 'text-warn' : tone === 'ok' ? 'text-ok' : 'text-ink',
        )}
      >
        {title}
      </b>
      <span>{children}</span>
    </div>
  );
}
