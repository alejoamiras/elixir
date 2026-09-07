import type * as React from 'react';
import { useState } from 'react';
import { cn } from '../lib/cn.ts';

/** A mono chip that copies on click: the label dim, the value bright, `full` (or the value) to the clipboard. */
export function Chip({
  label,
  value,
  full,
  className,
  ...props
}: Omit<React.ComponentProps<'button'>, 'value'> & { label: string; value: string; full?: string }) {
  const [copied, setCopied] = useState(false);
  const text = full ?? value;
  return (
    <button
      type="button"
      data-slot="chip"
      title={text}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-sm border border-line bg-panel px-2 py-1 font-mono text-2xs text-ink-2 hover:text-ink',
        className,
      )}
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      {...props}
    >
      <span>{label}</span> <span className="text-ink">{copied ? 'copied' : value}</span>
    </button>
  );
}
