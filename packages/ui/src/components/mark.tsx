import { cn } from '../lib/cn.ts';
import type { MarkState } from '../mark.ts';

const DOT_CLASS: Record<MarkState, string> = {
  idle: 'fill-ink-3',
  mining: 'fill-uv',
  won: 'fill-uv',
  paused: 'fill-bad',
};

/** Same geometry as markSvg (keep them in step); classes instead of literal colours. */
export function Mark({
  state = 'mining',
  size = 18,
  className,
}: {
  state?: MarkState;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      data-slot="mark"
      data-state={state}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={cn('shrink-0', className)}
    >
      <rect x="5" y="23" width="22" height="3" rx="1.5" className="fill-ink" />
      <circle
        cx="16"
        cy={state === 'won' ? 8 : 15}
        r="5"
        className={cn(
          'transition-[cy] duration-200 ease-out motion-reduce:transition-none',
          DOT_CLASS[state],
        )}
      />
    </svg>
  );
}
