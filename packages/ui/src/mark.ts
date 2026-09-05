import { DARK, ink } from './tokens.ts';

/** The favicon's four lights: grey dot, ultraviolet dot, the dot above the bar, red dot. */
export type MarkState = 'idle' | 'mining' | 'won' | 'paused';

const DOT: Record<MarkState, string> = {
  idle: ink(0.45),
  mining: DARK.uv,
  won: DARK.uv,
  paused: DARK.bad,
};

/**
 * The mark on a 32-unit canvas: a bar low in the frame, a dot resting on it, or risen above it
 * once a score cleared the bar. Geometry is shared with the <Mark> component.
 */
export const markSvg = (state: MarkState, size = 32, bar = DARK.ink): string => {
  const cy = state === 'won' ? 8 : 15;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<rect x="5" y="23" width="22" height="3" rx="1.5" fill="${bar}"/>` +
    `<circle cx="16" cy="${cy}" r="5" fill="${DOT[state]}"/>` +
    '</svg>'
  );
};

/** `img-src data:` is in the CSP for exactly this: a favicon that is a status light. */
export const faviconDataUrl = (state: MarkState): string =>
  `data:image/svg+xml,${encodeURIComponent(markSvg(state))}`;
