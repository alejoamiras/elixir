import type * as React from 'react';
import { cn } from '../lib/cn.ts';

export type IconName = 'mine' | 'wallet' | 'stats' | 'verify' | 'settings' | 'finger';

/** The glyphs, drawn on a 24-grid with a 1.6 stroke; each is a list of path data. */
const PATHS: Record<IconName, string[]> = {
  mine: ['M14 4l6 6M4 20l9-9M13 5l6 6', 'M9 9c2-3 6-4 9-3-1 3-2 5-3 6'],
  finger: ['M6 11a6 6 0 0 1 12 0v3M9 11a3 3 0 0 1 6 0v6M12 11v9M4 15a8 8 0 0 0 16 0'],
  wallet: ['M3 6h18v13H3z', 'M16 12h5M3 10h18'],
  stats: ['M4 20V10M10 20V4M16 20v-7M22 20H2'],
  verify: ['M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z', 'M9 12l2 2 4-4'],
  settings: [
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    'M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  ],
};

export function Icon({
  name,
  size = 14,
  className,
  ...props
}: Omit<React.ComponentProps<'svg'>, 'name'> & { name: IconName; size?: number }) {
  return (
    <svg
      data-slot="icon"
      data-icon={name}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={cn('shrink-0', className)}
      {...props}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
