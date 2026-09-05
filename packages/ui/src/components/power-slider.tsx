import * as React from 'react';
import { cn } from '../lib/cn.ts';

/** threads ∈ [1, cores − 1]: one core stays with the page. */
export const powerRange = (cores: number): { min: number; max: number } => ({
  min: 1,
  max: Math.max(1, cores - 1),
});

export const clampThreads = (threads: number, cores: number): number => {
  const { min, max } = powerRange(cores);
  return Math.min(max, Math.max(min, Math.round(threads)));
};

/** eco ≈ a quarter, balanced ≈ half, max = everything but one. */
export const powerLabels = (cores: number): { eco: number; balanced: number; max: number } => {
  const { max } = powerRange(cores);
  return { eco: Math.max(1, Math.ceil(max / 4)), balanced: Math.max(1, Math.ceil(max / 2)), max };
};

/** On few cores two labels share a value; they share a position too, or they would overlap. */
const mergedLabels = (labels: ReturnType<typeof powerLabels>): { names: string; threads: number }[] => {
  const byThreads = new Map<number, string[]>();
  for (const k of ['eco', 'balanced', 'max'] as const)
    byThreads.set(labels[k], [...(byThreads.get(labels[k]) ?? []), k]);
  return [...byThreads].map(([threads, names]) => ({ names: names.join(' / '), threads }));
};

export function PowerSlider({
  cores,
  threads,
  onChange,
  readout,
  className,
}: {
  cores: number;
  threads: number;
  onChange: (threads: number) => void;
  /** The measured rate, e.g. "18.4 / min"; the readout is never a prediction. */
  readout?: React.ReactNode;
  className?: string;
}) {
  const { min, max } = powerRange(cores);
  const labels = powerLabels(cores);
  const value = clampThreads(threads, cores);
  const pct = (t: number) => (max === min ? 0 : ((t - min) / (max - min)) * 100);
  const id = React.useId();
  return (
    <div data-slot="power-slider" className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label-mono">
          power
        </label>
        <span className="font-mono text-xs text-ink-2">
          {value} {value === 1 ? 'thread' : 'threads'}
          {readout !== undefined && <span> · {readout}</span>}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(clampThreads(Number(e.target.value), cores))}
        aria-valuetext={`${value} of ${max} threads`}
        className="w-full accent-uv"
      />
      <div className="relative h-8 font-mono text-2xs text-ink-2" aria-hidden>
        {mergedLabels(labels).map(({ names, threads: t }) => {
          const at = pct(t);
          const edge = at <= 0 ? 'left-0' : at >= 100 ? 'right-0' : '-translate-x-1/2';
          return (
            <span
              key={names}
              data-slot="power-label"
              data-on={t === value ? '' : undefined}
              className={cn('absolute whitespace-nowrap', edge, t === value && 'text-uv-2')}
              style={edge === '-translate-x-1/2' ? { left: `${at}%` } : undefined}
            >
              {names} · {t}
            </span>
          );
        })}
      </div>
    </div>
  );
}
