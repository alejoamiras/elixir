import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn.ts';
import { Button, type buttonVariants } from './button.tsx';

/**
 * A destructive action confirmed by a completed gesture the user can still abort: the fill runs for `holdMs`
 * while the pointer or key is held, and `onConfirm` fires once, on the release that follows a completed fill.
 * Releasing early, leaving, losing focus, hiding the document, unmounting or becoming disabled cancels. The
 * gesture is never the only path: callers also offer a plain click, and eligibility lives in `onConfirm`.
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
  const [progress, setProgress] = useState(0);
  const armed = useRef(false);
  const holding = useRef(false);
  const start = useRef(0);
  const frame = useRef(0);
  const hint = useId();

  const cancel = useCallback(() => {
    cancelAnimationFrame(frame.current);
    armed.current = false;
    holding.current = false;
    start.current = 0;
    setProgress(0);
  }, []);

  const begin = useCallback(() => {
    if (disabled || holding.current) return;
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
  }, [disabled, holdMs]);

  const release = useCallback(() => {
    const confirm = armed.current;
    cancel();
    if (confirm) onConfirm();
  }, [cancel, onConfirm]);

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

  const key = (e: React.KeyboardEvent) => e.key === ' ' || e.key === 'Enter';
  return (
    <Button
      type="button"
      variant={variant}
      disabled={disabled}
      aria-describedby={hint}
      className={cn('relative overflow-hidden', className)}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture?.(e.pointerId);
        begin();
      }}
      onPointerUp={release}
      onPointerCancel={cancel}
      onPointerLeave={cancel}
      onBlur={cancel}
      onKeyDown={(e) => {
        if (!key(e) || e.repeat) return;
        e.preventDefault();
        begin();
      }}
      onKeyUp={(e) => key(e) && release()}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 bg-bad/25"
        style={{ width: `${progress * 100}%` }}
      />
      <span className="relative">{children}</span>
      <span
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-label="hold progress"
        className="sr-only"
      />
      <span id={hint} className="sr-only">
        hold, then release
      </span>
    </Button>
  );
}
