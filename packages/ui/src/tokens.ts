/**
 * The dark palette as literals, for the consumers that cannot read CSS variables: the favicon
 * data URL and canvas fallbacks. `tokens.test.ts` keeps it equal to `:root` in theme.css.
 */
export const DARK = {
  ground: '#0a0a0b',
  raised: '#111114',
  panel: '#17171b',
  ink: '#f2efe9',
  uv: '#8c6bff',
  uv2: '#b39dff',
  ok: '#58c98b',
  warn: '#e8b54d',
  bad: '#e5624f',
} as const;

/** Alpha-blended ink, the way theme.css defines ink-2…4 and the lines. */
export const ink = (alpha: number): string => `rgba(242, 239, 233, ${alpha})`;
