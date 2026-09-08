import { useEffect, useRef, useState } from 'react';
import { useDocumentHidden, useReducedMotion } from './use-reduced-motion.ts';

const easeOutCubic = (x: number): number => 1 - (1 - x) ** 3;

/**
 * A display number that glides to `value` over `ms` on the animation clock, and jumps to it under reduced
 * motion or a hidden document. For display only: anything that signs or sends reads the store.
 */
export function useTweenedNumber(value: number, ms = 300): number {
  const reduced = useReducedMotion();
  const hidden = useDocumentHidden();
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const frame = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(frame.current);
    if (reduced || hidden || !Number.isFinite(value) || !Number.isFinite(from.current)) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = from.current;
    if (start === value) return;
    let t0: number | undefined;
    const step = (t: number) => {
      t0 ??= t;
      const k = Math.min(1, (t - t0) / ms);
      const next = start + (value - start) * easeOutCubic(k);
      from.current = next;
      setShown(next);
      if (k < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [value, ms, reduced, hidden]);
  return shown;
}
