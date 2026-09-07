import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn.ts';
import { Button, type buttonVariants } from './button.tsx';

type Owner = number | 'key';

/**
 * The hold gesture: the fill runs for `holdMs` on the frame clock while held; `onConfirm` fires once, on the
 * release by the same pointer or key that began the hold, after the fill completed. Anything else cancels.
 */
function useHold(onConfirm: () => void, holdMs: number, disabled: boolean | undefined) {
  const [progress, setProgress] = useState(0);
  const armed = useRef(false);
  const holding = useRef(false);
  const start = useRef(0);
  const frame = useRef(0);
  const owner = useRef<Owner | null>(null);

  const cancel = useCallback(() => {
    cancelAnimationFrame(frame.current);
    armed.current = false;
    holding.current = false;
    start.current = 0;
    owner.current = null;
    setProgress(0);
  }, []);

  const begin = useCallback(
    (by: Owner) => {
      if (disabled || holding.current || owner.current !== null) return false;
      owner.current = by;
      holding.current = true;
      // Elapsed time is measured on the frame clock alone, from the first frame's timestamp.
      const tick = (t: number) => {
        if (!holding.current) return;
        start.current ||= t;
        const k = Math.min(1, (t - start.current) / holdMs);
        setProgress(k);
        if (k >= 1) armed.current = true;
        else frame.current = requestAnimationFrame(tick);
      };
      frame.current = requestAnimationFrame(tick);
      return true;
    },
    [disabled, holdMs],
  );

  const release = useCallback(
    (by: Owner) => {
      if (owner.current !== by) return;
      const confirm = armed.current;
      cancel();
      if (confirm) onConfirm();
    },
    [cancel, onConfirm],
  );

  useEffect(() => {
    const hide = () => document.hidden && cancel();
    document.addEventListener('visibilitychange', hide);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      cancel();
    };
  }, [cancel]);
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled, cancel]);

  return { progress, begin, release, cancel, owns: (by: Owner) => owner.current === by };
}

/** With the pointer captured, leave events never fire: the bounds are checked on every move instead. */
const inside = (e: React.PointerEvent<HTMLButtonElement>): boolean => {
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
};

const isKey = (e: React.KeyboardEvent) => e.key === ' ' || e.key === 'Enter';

/**
 * A destructive action confirmed by a completed gesture the user can still abort. The gesture is never the
 * only path: callers also offer a plain click, and eligibility lives in `onConfirm`.
 */
export function HoldButton({
  onConfirm,
  holdMs = 1200,
  disabled,
  className,
  children,
  variant = 'danger',
  ...props
}: Omit<React.ComponentProps<'button'>, 'onClick'> &
  VariantProps<typeof buttonVariants> & { onConfirm: () => void; holdMs?: number }) {
  const hold = useHold(onConfirm, holdMs, disabled);
  const hint = useId();
  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled}
      aria-describedby={hint}
      className={cn('relative overflow-hidden', className)}
      onPointerDown={(e) => hold.begin(e.pointerId) && e.currentTarget.setPointerCapture?.(e.pointerId)}
      onPointerMove={(e) => hold.owns(e.pointerId) && !inside(e) && hold.cancel()}
      onPointerUp={(e) => (inside(e) ? hold.release(e.pointerId) : hold.cancel())}
      onPointerCancel={hold.cancel}
      onLostPointerCapture={hold.cancel}
      onPointerLeave={hold.cancel}
      onBlur={hold.cancel}
      onKeyDown={(e) => {
        if (!isKey(e) || e.repeat) return;
        e.preventDefault();
        hold.begin('key');
      }}
      onKeyUp={(e) => isKey(e) && hold.release('key')}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 bg-bad/25"
        style={{ width: `${hold.progress * 100}%` }}
      />
      <span className="relative">{children}</span>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(hold.progress * 100)}
        aria-label="hold progress"
        className="sr-only"
      />
      <span id={hint} className="sr-only">
        hold, then release
      </span>
    </Button>
  );
}
