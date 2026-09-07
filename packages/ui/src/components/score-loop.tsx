import * as React from 'react';
import { useDocumentHidden, useReducedMotion } from '../hooks/use-reduced-motion.ts';
import { cn } from '../lib/cn.ts';
import { axis, axisTo, axisTop, difficultyLabel, flash, rise, type Sample } from '../score-loop-model.ts';
import { DARK, ink } from '../tokens.ts';

export interface ScoreLoopProps {
  difficulty: number;
  /** Every attempt of the window, oldest first, on the performance.now() clock. */
  samples: readonly Sample[];
  /** The last win's time, for the bar flash. */
  winAt?: number | null;
  spanMs?: number;
  height?: number;
  /** The landing hero draws larger type and margins. */
  hero?: boolean;
  /**
   * The calm rendering: no grid, the bar as the only line labelled once, proofs as dim ticks, the win bright
   * with its score; the axis ceiling follows the bar and the best score in view instead of a fixed 1000.
   */
  calm?: boolean;
  /** Padding and type size, for a strip too short for the defaults (the pop-out's 48 px). */
  geometry?: { pad: number; fontPx: number };
  /** The window that owns the animation clock and visibility: the pop-out's, when drawn there. */
  win?: Window;
  className?: string;
}

interface Palette {
  uv: string;
  uv2: string;
  ink: string;
  ink3: string;
  line: string;
}

// The canvas cannot use Tailwind classes; it reads the same variables theme.css sets on :root.
const palette = (el: HTMLElement): Palette => {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  return {
    uv: v('--uv', DARK.uv),
    uv2: v('--uv-2', DARK.uv2),
    ink: v('--ink', DARK.ink),
    ink3: v('--ink-3', ink(0.5)),
    line: v('--line', ink(0.1)),
  };
};

interface Frame {
  ctx: CanvasRenderingContext2D;
  w: number;
  h: number;
  pad: number;
  left: number;
  p: Palette;
  hero: boolean;
  fontPx: number;
  /** Score → 0…1 on the axis in force (fixed 1–1000, or the calm ceiling). */
  scale: (score: number) => number;
}

const yOf = (f: Frame, fraction: number) => f.h - f.pad - fraction * (f.h - f.pad * 2);

function drawGrid(f: Frame, right: number) {
  const { ctx } = f;
  ctx.font = `${f.fontPx}px "JetBrains Mono Variable", monospace`;
  ctx.textBaseline = 'middle';
  for (const g of [1, 10, 100, 1000]) {
    const y = yOf(f, f.scale(g));
    ctx.strokeStyle = f.p.line;
    ctx.beginPath();
    ctx.moveTo(f.left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
    ctx.fillStyle = f.p.ink3;
    ctx.textAlign = 'right';
    ctx.fillText(String(g), f.left - 10, y);
  }
}

function drawBar(f: Frame, right: number, difficulty: number, glow: number) {
  const { ctx } = f;
  const y = yOf(f, f.scale(difficulty));
  ctx.strokeStyle = glow > 0 ? f.p.uv2 : f.p.uv;
  ctx.lineWidth = 1.5 + glow * 1.5;
  ctx.beginPath();
  ctx.moveTo(f.left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = f.p.uv2;
  ctx.textAlign = 'left';
  ctx.fillText(`difficulty ${difficultyLabel(difficulty)} · the bar`, f.left + 6, y - 10);
}

function drawDots(f: Frame, right: number, props: ScoreLoopProps, now: number, reduced: boolean) {
  const { ctx } = f;
  const span = props.spanMs ?? 60_000;
  const base = f.h - f.pad;
  for (const s of props.samples) {
    const age = (now - s.t) / span;
    if (age > 1 || age < 0) continue;
    const x = right - age * (right - f.left);
    const y = base - (base - yOf(f, f.scale(s.score))) * rise(now, s.t, reduced);
    const win = s.score >= props.difficulty;
    ctx.strokeStyle = win ? f.p.uv2 : f.p.line;
    ctx.beginPath();
    ctx.moveTo(x, base);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.fillStyle = win ? f.p.uv2 : f.p.ink;
    ctx.globalAlpha = win ? 1 : 0.85 - age * 0.6;
    ctx.beginPath();
    ctx.arc(x, y, win ? 4 : 2.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    if (win) {
      ctx.strokeStyle = f.p.uv;
      ctx.beginPath();
      ctx.arc(x, y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawLabels(f: Frame, right: number, props: ScoreLoopProps) {
  const { ctx } = f;
  const last = props.samples[props.samples.length - 1];
  if (last) {
    const win = last.score >= props.difficulty;
    ctx.fillStyle = win ? f.p.uv2 : f.p.ink;
    ctx.textAlign = 'right';
    const y = Math.max(f.pad - 6, yOf(f, f.scale(last.score)) - 12);
    ctx.fillText(`${win ? 'clears the bar · ' : ''}score ${last.score.toFixed(1)}`, right, y);
  }
  ctx.fillStyle = f.p.ink3;
  ctx.textAlign = 'left';
  ctx.fillText(`−${Math.round((props.spanMs ?? 60_000) / 1000)} s`, f.left, f.h - 9);
  ctx.textAlign = 'right';
  ctx.fillText('now', right, f.h - 9);
}

/** Calm: the baseline at score 1 and the bar, each labelled once on the axis; no grid. */
function drawCalmLines(f: Frame, right: number, difficulty: number, glow: number) {
  const { ctx } = f;
  ctx.font = `${f.fontPx}px "JetBrains Mono Variable", monospace`;
  ctx.textBaseline = 'middle';
  const base = f.h - f.pad;
  ctx.strokeStyle = f.p.line;
  ctx.beginPath();
  ctx.moveTo(f.left, base);
  ctx.lineTo(right, base);
  ctx.stroke();
  ctx.fillStyle = f.p.ink3;
  ctx.textAlign = 'right';
  ctx.fillText('1', f.left - 8, base);
  const y = yOf(f, f.scale(difficulty));
  ctx.strokeStyle = glow > 0 ? f.p.uv2 : f.p.uv;
  ctx.lineWidth = 2 + glow * 1.5;
  ctx.beginPath();
  ctx.moveTo(f.left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = f.p.uv2;
  ctx.fillText(difficultyLabel(difficulty), f.left - 8, y);
  if (f.h > 80) ctx.fillText('the bar · clear it to win', right, y - f.fontPx);
}

function tick(f: Frame, x: number, y: number, color: string, width: number, alpha = 1) {
  const { ctx } = f;
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, f.h - f.pad);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 1;
}

/** Calm: a win is the ringed dot, with its score beside it when there is room for type. */
function drawCalmWin(f: Frame, right: number, x: number, y: number, score: number) {
  const { ctx } = f;
  const tall = f.h > 80;
  tick(f, x, y, f.p.uv2, 1.5);
  ctx.fillStyle = f.p.uv2;
  ctx.beginPath();
  ctx.arc(x, y, tall ? 5 : 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = f.p.uv2;
  ctx.beginPath();
  ctx.arc(x, y, tall ? 9 : 6.5, 0, Math.PI * 2);
  ctx.stroke();
  if (!tall) return;
  const flip = x > right - 90;
  ctx.fillStyle = f.p.ink;
  ctx.textAlign = flip ? 'right' : 'left';
  ctx.fillText(`★ ${score.toFixed(1)} · a win`, x + (flip ? -14 : 14), y - 4);
}

/** Calm: ordinary proofs are dim ticks from the baseline; wins are drawn bright; the window's ends are labelled. */
function drawCalmDots(f: Frame, right: number, props: ScoreLoopProps, now: number, reduced: boolean) {
  const { ctx } = f;
  const span = props.spanMs ?? 180_000;
  const base = f.h - f.pad;
  for (const s of props.samples) {
    const age = (now - s.t) / span;
    if (age > 1 || age < 0) continue;
    const x = right - age * (right - f.left);
    const y = base - (base - yOf(f, f.scale(s.score))) * rise(now, s.t, reduced);
    if (s.score >= props.difficulty) drawCalmWin(f, right, x, y, s.score);
    else if (f.h > 80) tick(f, x, y, f.p.ink3, 2, 0.55);
    else {
      ctx.fillStyle = f.p.uv;
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  if (f.h <= 80) return;
  ctx.fillStyle = f.p.ink3;
  ctx.textAlign = 'left';
  ctx.fillText(`−${Math.round(span / 60_000)} min`, f.left, f.h - f.fontPx / 2 - 2);
  ctx.textAlign = 'right';
  ctx.fillText('now', right, f.h - f.fontPx / 2 - 2);
}

function layout(props: ScoreLoopProps): { pad: number; fontPx: number; left: number } {
  if (props.geometry) return { ...props.geometry, left: 28 };
  return props.hero ? { pad: 30, fontPx: 12, left: 58 } : { pad: 24, fontPx: 11, left: 48 };
}

/** The score axis in force: the fixed 1–1000 log, or the calm ceiling over what this window shows. */
function scaleFor(props: ScoreLoopProps, now: number): (score: number) => number {
  if (!props.calm) return axis;
  const span = props.spanMs ?? 180_000;
  // The ceiling is computed from what this window shows, not from everything the store retains.
  const top = axisTop(
    props.difficulty,
    props.samples.filter((s) => now - s.t <= span && now - s.t >= 0),
  );
  return (score) => axisTo(score, top);
}

/** Sizes the backing store to the element and the device, and builds the frame the drawing functions share. */
function frame(canvas: HTMLCanvasElement, props: ScoreLoopProps, now: number): Frame | undefined {
  const ctx = canvas.getContext('2d');
  const w = canvas.clientWidth;
  if (!ctx || w < 2) return undefined;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const h = props.height ?? 200;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const { pad, fontPx, left } = layout(props);
  return {
    ctx,
    w,
    h,
    pad,
    left,
    p: palette(canvas),
    hero: props.hero ?? false,
    fontPx,
    scale: scaleFor(props, now),
  };
}

function draw(canvas: HTMLCanvasElement, props: ScoreLoopProps, now: number, reduced: boolean) {
  const f = frame(canvas, props, now);
  if (!f) return;
  const right = f.w - 14;
  const glow = flash(now, props.winAt ?? null);
  if (props.calm) {
    drawCalmLines(f, right, props.difficulty, glow);
    drawCalmDots(f, right, { ...props, spanMs: props.spanMs ?? 180_000 }, now, reduced);
    return;
  }
  drawGrid(f, right);
  drawBar(f, right, props.difficulty, glow);
  drawDots(f, right, props, now, reduced);
  drawLabels(f, right, props);
}

/**
 * Draws on requestAnimationFrame while visible in a foreground tab; a still frame under reduced motion. When
 * `win` is another window (the pop-out), that window's clock and visibility drive the loop.
 */
export function ScoreLoop(props: ScoreLoopProps) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const pageHidden = useDocumentHidden();
  const [winHidden, setWinHidden] = React.useState(false);
  const win = props.win;
  React.useEffect(() => {
    if (!win) return;
    const onVis = () => setWinHidden(win.document.hidden);
    onVis();
    win.document.addEventListener('visibilitychange', onVis);
    return () => win.document.removeEventListener('visibilitychange', onVis);
  }, [win]);
  const hidden = win ? winHidden : pageHidden;
  const latest = React.useRef(props);
  latest.current = props;

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || hidden) return;
    const w = win ?? window;
    // Samples carry the opener's performance.now(); a pop-out's rAF timestamps run on its own, later
    // time origin, so frames are scheduled on `w` but every age is measured on the page's clock.
    const clock = () => performance.now();
    if (!reduced) {
      let raf = 0;
      const tick = () => {
        draw(canvas, latest.current, clock(), false);
        raf = w.requestAnimationFrame(tick);
      };
      raf = w.requestAnimationFrame(tick);
      return () => w.cancelAnimationFrame(raf);
    }
    // A still frame is only right for the size and palette it was drawn with.
    const still = () => draw(canvas, latest.current, clock(), true);
    still();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(still);
    resize?.observe(canvas);
    const theme = new MutationObserver(still);
    theme.observe(w.document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      resize?.disconnect();
      theme.disconnect();
    };
  }, [reduced, hidden, win]);

  React.useEffect(() => {
    const canvas = ref.current;
    if (canvas && reduced && !hidden) draw(canvas, props, performance.now(), true);
  }, [props, reduced, hidden]);

  const span = props.spanMs ?? (props.calm ? 180_000 : 60_000);
  return (
    <canvas
      ref={ref}
      data-slot="score-loop"
      data-reduced={reduced || undefined}
      data-calm={props.calm || undefined}
      role="img"
      aria-label={`score loop: ${props.samples.length} proofs in the last ${Math.round(span / 1000)} seconds, difficulty ${difficultyLabel(props.difficulty)}`}
      className={cn('block w-full', props.className)}
      style={{ height: props.height ?? 200 }}
    />
  );
}
