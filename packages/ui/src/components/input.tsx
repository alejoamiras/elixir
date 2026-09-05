import type * as React from 'react';
import { cn } from '../lib/cn.ts';

function Input({ className, type, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'h-[38px] w-full min-w-0 rounded-md border border-line-2 bg-panel px-3 text-sm text-ink transition-colors outline-none placeholder:text-ink-3 focus-visible:border-uv focus-visible:ring-3 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-bad aria-invalid:ring-3 aria-invalid:ring-bad/20',
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        'min-h-24 w-full rounded-md border border-line-2 bg-panel px-3 py-2 font-mono text-sm text-ink transition-colors outline-none placeholder:text-ink-3 focus-visible:border-uv focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-50 aria-invalid:border-bad',
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
