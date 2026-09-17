import type * as React from 'react';
import { cn } from '../lib/cn.ts';

export type NoteTone = 'neutral' | 'warn' | 'ok' | 'bad' | 'uv';

const TITLE: Record<NoteTone, string> = {
  neutral: 'text-ink',
  warn: 'text-warn',
  ok: 'text-ok',
  bad: 'text-bad',
  uv: 'text-uv-2',
};
const BORDER: Record<NoteTone, string> = {
  neutral: 'border-line bg-panel',
  warn: 'border-warn/50',
  ok: 'border-ok/45',
  bad: 'border-bad/50',
  uv: 'border-uv/50',
};

/**
 * A boxed aside inside a sheet or a dialog: a bold first line (what happened), then the explanation
 * (what to do). `neutral` sits on the panel ground; the other tones carry their colour on the border.
 */
export function Note({
  title,
  tone = 'neutral',
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'title'> & { title: React.ReactNode; tone?: NoteTone }) {
  return (
    <div
      data-slot="note"
      data-tone={tone}
      className={cn(
        'flex flex-col gap-1 rounded-[8px] border border-line-2 px-3.5 py-3 text-[13px] leading-[1.5] text-ink-2',
        BORDER[tone],
        className,
      )}
      {...props}
    >
      <b className={cn('text-[13.5px] font-medium', TITLE[tone])}>{title}</b>
      <span>{children}</span>
    </div>
  );
}
