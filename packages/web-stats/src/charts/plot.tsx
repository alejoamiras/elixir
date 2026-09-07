import * as Plot from '@observablehq/plot';
import { type ComponentProps, type RefObject, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn, useReducedMotion } from '../../../ui/src/index.ts';
import { type ChartInput, HEIGHT, type Spec } from './specs';

const FADE_MS = 240;
type Figure = HTMLElement | SVGSVGElement;

/** The container's width through a ResizeObserver; 640 where there is none (jsdom) or nothing is laid out yet. */
function useWidth(ref: RefObject<HTMLDivElement | null>): number {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setWidth(el.clientWidth);
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry?.contentRect.width ?? 0)));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width || 640;
}

/** The outgoing figure fades under the incoming one, then goes; both stay inert while it lasts. */
function crossFade(next: Figure, previous: Figure[]): () => void {
  next.style.opacity = '0';
  next.style.transition = `opacity ${FADE_MS}ms ease`;
  for (const p of previous) {
    p.setAttribute('aria-hidden', 'true');
    p.style.pointerEvents = 'none';
    p.style.transition = `opacity ${FADE_MS}ms ease`;
    p.style.opacity = '0';
  }
  const frame = requestAnimationFrame(() => {
    next.style.opacity = '1';
  });
  const timer = setTimeout(() => {
    for (const p of previous) p.remove();
  }, FADE_MS + 20);
  return () => {
    cancelAnimationFrame(frame);
    clearTimeout(timer);
    for (const p of previous) p.remove();
  };
}

/**
 * Draws `spec` into a fixed-height container: a fresh figure on every change of rows, selection
 * or width (Plot re-creates its nodes; there is nothing to tween), cross-faded only when the set
 * of epochs changed (a close or an open, not a claim count), instantly under reduced motion.
 */
export function Chart({
  spec,
  input,
  className,
  ...props
}: { spec: Spec; input: Omit<ChartInput, 'width'> } & ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null);
  const width = useWidth(ref);
  const reduced = useReducedMotion();
  const epochs = input.rows.map((r) => r.epoch).join(',');
  const drawn = useRef<string | null>(null);
  const { rows, selected, rules } = input;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const figure = Plot.plot(spec({ rows, selected, rules, width }));
    figure.style.position = 'absolute';
    figure.style.inset = '0';
    const previous = Array.from(el.children) as Figure[];
    const animate = !reduced && drawn.current !== null && drawn.current !== epochs;
    drawn.current = epochs;
    el.append(figure);
    if (!animate) {
      for (const p of previous) p.remove();
      return;
    }
    return crossFade(figure, previous);
  }, [spec, rows, selected, rules, width, epochs, reduced]);
  return (
    <div
      ref={ref}
      className={cn('relative w-full', className)}
      style={{ height: HEIGHT }}
      data-slot="chart"
      {...props}
    />
  );
}
