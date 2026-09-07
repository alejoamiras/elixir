import type * as React from 'react';
import { useState } from 'react';
import { cn } from '../lib/cn.ts';

/**
 * An outbound link for a chain value: new tab, no opener, no referrer, the full value in `title`. Without
 * `href` it renders as plain text. `copy` adds a sibling button for the full value, separate from the anchor.
 */
export function ExternalLink({
  href,
  full,
  copy,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'a'>, 'href'> & { href?: string; full?: string; copy?: boolean }) {
  const [copied, setCopied] = useState<'ok' | 'failed' | null>(null);
  const text = full ?? (typeof children === 'string' ? children : undefined);
  const body = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={full}
      className={cn('font-mono hover:text-ink hover:underline underline-offset-3', className)}
      {...props}
    >
      {children}
      <span aria-hidden className="ml-1 text-uv-2">
        ↗
      </span>
      <span className="sr-only"> (opens the explorer)</span>
    </a>
  ) : (
    <span title={full} className={cn('font-mono', className)}>
      {children}
    </span>
  );
  if (!copy || !text) return body;
  return (
    <span className="inline-flex items-center gap-1.5">
      {body}
      <button
        type="button"
        className="font-mono text-2xs text-ink-3 hover:text-ink"
        aria-label={`copy ${text}`}
        onClick={() =>
          navigator.clipboard
            .writeText(text)
            .then(() => setCopied('ok'))
            .catch(() => setCopied('failed'))
            .finally(() => setTimeout(() => setCopied(null), 1600))
        }
      >
        {copied === 'ok' ? 'copied' : copied === 'failed' ? 'copy failed' : 'copy'}
      </button>
    </span>
  );
}
