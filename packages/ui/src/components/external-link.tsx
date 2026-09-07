import type * as React from 'react';
import { useState } from 'react';
import { cn } from '../lib/cn.ts';

/**
 * An outbound link for a chain value: opens in a new tab, never hands the target a window handle or a
 * referrer, shows the short form and carries the full value in `title`. Without `href` it is plain text,
 * so a value whose link could not be built still renders. `copy` adds a small sibling button for the full
 * value, kept separate from the anchor so a click never means two things.
 */
export function ExternalLink({
  href,
  full,
  copy,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'a'>, 'href'> & { href?: string; full?: string; copy?: boolean }) {
  const [copied, setCopied] = useState(false);
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
        onClick={async () => {
          await navigator.clipboard.writeText(text).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </span>
  );
}
