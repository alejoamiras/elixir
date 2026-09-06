import * as React from 'react';
import { useDocumentHidden, useReducedMotion } from '../hooks/use-reduced-motion.ts';
import { cn } from '../lib/cn.ts';
import { axis, flash, rise, type Sample } from '../score-loop-model.ts';
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
    ink3: v('--ink-3', ink(0.4)),
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
}

const yOf = (f: Frame, fraction: number) => f.h - f.pad - fraction * (f.h - f.pad * 2);

function drawGrid(f: Frame, right: number) {
  const { ctx } = f;
  ctx.font = `${f.hero ? 12 : 11}px "JetBrains Mono Variable", monospace`;
  ctx.textBaseline = 'middle';
  for (const g of [1, 10, 100, 1000]) {
    const y = yOf(f, axis(g));
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
  const y = yOf(f, axis(difficulty));
  ctx.strokeStyle = glow > 0 ? f.p.uv2 : f.p.uv;
  ctx.lineWidth = 1.5 + glow * 1.5;
  ctx.beginPath();
  ctx.moveTo(f.left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
  ctx.lineWidth = 1;
  ctx.fillStyle = f.p.uv2;
  ctx.textAlign = 'left';
  ctx.fillText(`difficulty ${difficulty.toFixed(1)} · the bar`, f.left + 6, y - 10);
}

function drawDots(f: Frame, right: number, props: ScoreLoopProps, now: number, reduced: boolean) {
  const { ctx } = f;
  const span = props.spanMs ?? 60_000;
  const base = f.h - f.pad;
  for (const s of props.samples) {
    const age = (now - s.t) / span;
    if (age > 1 || age < 0) continue;
    const x = right - age * (right - f.left);
    const y = base - (base - yOf(f, axis(s.score))) * rise(now, s.t, reduced);
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
    const y = Math.max(f.pad - 6, yOf(f, axis(last.score)) - 12);
    ctx.fillText(`${win ? 'clears the bar · ' : ''}score ${last.score.toFixed(1)}`, right, y);
  }
  ctx.fillStyle = f.p.ink3;
  ctx.textAlign = 'left';
  ctx.fillText(`−${Math.round((props.spanMs ?? 60_000) / 1000)} s`, f.left, f.h - 9);
  ctx.textAlign = 'right';
  ctx.fillText('now', right, f.h - 9);
}

function draw(canvas: HTMLCanvasElement, props: ScoreLoopProps, now: number, reduced: boolean) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = props.height ?? 200;
  if (w < 2) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const hero = props.hero ?? false;
  const f: Frame = { ctx, w, h, pad: hero ? 30 : 24, left: hero ? 58 : 48, p: palette(canvas), hero };
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const right = w - 14;
  drawGrid(f, right);
  drawBar(f, right, props.difficulty, flash(now, props.winAt ?? null));
  drawDots(f, right, props, now, reduced);
  drawLabels(f, right, props);
}

/** Draws on requestAnimationFrame while visible in a foreground tab; a still frame under reduced motion. */
export function ScoreLoop(props: ScoreLoopProps) {
  const ref = React.useRef<HTMLCanvasElement>(null);
  const reduced = useReducedMotion();
  const hidden = useDocumentHidden();
  const latest = React.useRef(props);
  latest.current = props;

  React.useEffect(() => {
    const canvas = ref.current;
    if (!canvas || hidden) return;
    if (!reduced) {
      let raf = 0;
      const tick = (now: number) => {
        draw(canvas, latest.current, now, false);
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    // A still frame is only right for the size and palette it was drawn with.
    const still = () => draw(canvas, latest.current, performance.now(), true);
    still();
    const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(still);
    resize?.observe(canvas);
    const theme = new MutationObserver(still);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      resize?.disconnect();
      theme.disconnect();
    };
  }, [reduced, hidden]);

  React.useEffect(() => {
    const canvas = ref.current;
    if (canvas && reduced && !hidden) draw(canvas, props, performance.now(), true);
  }, [props, reduced, hidden]);

  return (
    <canvas
      ref={ref}
      data-slot="score-loop"
      data-reduced={reduced || undefined}
      role="img"
      aria-label={`score loop: ${props.samples.length} proofs in the last ${Math.round((props.spanMs ?? 60_000) / 1000)} seconds, difficulty ${props.difficulty.toFixed(1)}`}
      className={cn('block w-full', props.className)}
      style={{ height: props.height ?? 200 }}
    />
  );
}
