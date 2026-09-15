import type { VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { cn } from '../lib/cn.ts';
import { Button, type buttonVariants } from './button.tsx';

/** The pointer id, or the key, that began the hold; only the same one may release it. */
type Owner = number | 'Space' | 'Enter';

/**
 * The hold gesture: the fill runs for `holdMs` on the frame clock while held; `onConfirm` fires once, on the
 * release by the same pointer or key that began the hold, after the fill completed. Anything else cancels.
 */
function useHold(
  onConfirm: () => void,
  holdMs: number,
  disabled: boolean | undefined,
  onAbandon?: () => void,
) {
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

  /** A hold the user let go of, or left, before it filled: cancels, and says so once. */
  const abandon = useCallback(() => {
    const early = holding.current && !armed.current;
    cancel();
    if (early) onAbandon?.();
  }, [cancel, onAbandon]);

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
      if (confirm) {
        cancel();
        onConfirm();
      } else abandon();
    },
    [cancel, abandon, onConfirm],
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

  return { progress, begin, release, cancel, abandon, owns: (by: Owner) => owner.current === by };
}

/** With the pointer captured, leave events never fire: the bounds are checked on every move instead. */
const inside = (e: React.PointerEvent<HTMLButtonElement>): boolean => {
  const r = e.currentTarget.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
};

const keyOwner = (e: React.KeyboardEvent): 'Space' | 'Enter' | null =>
  e.key === ' ' ? 'Space' : e.key === 'Enter' ? 'Enter' : null;

/**
 * A destructive action confirmed by a completed gesture the user can still abort. Nothing but the hold
 * shows at rest; `reveal` (the click path, for whoever can only click) appears under the button once a
 * hold was let go of early, or on a click no hold produced (voice control and switch access dispatch a
 * click and cannot hold). `waitingLabel` replaces the gesture while the action must wait (a claim in
 * flight): the button reads it, dimmed, and arms once the label is gone. Eligibility lives in `onConfirm`.
 */
export function HoldButton({
  onConfirm,
  holdMs = 1200,
  disabled,
  waitingLabel,
  reveal,
  className,
  children,
  variant = 'danger',
  ...props
}: Omit<React.ComponentProps<'button'>, 'onClick'> &
  VariantProps<typeof buttonVariants> & {
    onConfirm: () => void;
    holdMs?: number;
    waitingLabel?: React.ReactNode;
    reveal?: React.ReactNode;
  }) {
  const waiting = waitingLabel !== undefined;
  const [revealed, setRevealed] = useState(false);
  const onAbandon = useCallback(() => setRevealed(true), []);
  const hold = useHold(onConfirm, holdMs, disabled || waiting, onAbandon);
  const hint = useId();
  const button = (
    <Button
      type="button"
      variant={variant}
      disabled={disabled || waiting}
      aria-describedby={hint}
      data-waiting={waiting || undefined}
      className={cn('relative overflow-hidden', waiting && 'opacity-60', className)}
      onPointerDown={(e) => hold.begin(e.pointerId) && e.currentTarget.setPointerCapture?.(e.pointerId)}
      onPointerMove={(e) => hold.owns(e.pointerId) && !inside(e) && hold.abandon()}
      onPointerUp={(e) => (inside(e) ? hold.release(e.pointerId) : hold.abandon())}
      onPointerCancel={hold.abandon}
      onLostPointerCapture={hold.abandon}
      onPointerLeave={hold.abandon}
      onBlur={hold.abandon}
      onClick={() => !(disabled || waiting) && setRevealed(true)}
      onKeyDown={(e) => {
        const by = keyOwner(e);
        if (!by || e.repeat) return;
        e.preventDefault();
        hold.begin(by);
      }}
      onKeyUp={(e) => {
        const by = keyOwner(e);
        if (by) hold.release(by);
      }}
      {...props}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 bg-bad/25"
        style={{ width: `${hold.progress * 100}%` }}
      />
      <span className="relative">{waiting ? waitingLabel : children}</span>
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
  if (reveal === undefined) return button;
  return (
    <span data-slot="hold" className="inline-flex flex-col items-start gap-1.5">
      {button}
      {revealed && (
        <span data-slot="hold-reveal" className="text-xs text-ink-2">
          {reveal}
        </span>
      )}
    </span>
  );
}
