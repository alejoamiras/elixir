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

/** On few cores two presets share a value; they share a button too. */
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
  label = 'power',
  disabled,
  className,
}: {
  cores: number;
  threads: number;
  onChange: (threads: number) => void;
  /** The measured rate, e.g. "18.4 proofs/min"; the readout is never a prediction. */
  readout?: React.ReactNode;
  /** What the threads are, where "power" alone would not say (Settings: "browser threads"). */
  label?: string;
  /** The setting is kept but not in force (another prover decides the threads): shown dimmed, not editable. */
  disabled?: boolean;
  className?: string;
}) {
  const { min, max } = powerRange(cores);
  const labels = powerLabels(cores);
  const value = clampThreads(threads, cores);
  const presets = mergedLabels(labels);
  const id = React.useId();
  return (
    <div
      data-slot="power-slider"
      data-disabled={disabled ? '' : undefined}
      className={cn('flex flex-col gap-2', disabled && 'opacity-45', className)}
    >
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="label-mono">
          {label}
        </label>
        <span className="font-mono text-2xs tracking-[0.04em] text-ink-3">
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
        disabled={disabled}
        onChange={(e) => onChange(clampThreads(Number(e.target.value), cores))}
        aria-valuetext={`${value} of ${max} threads`}
        className="w-full accent-uv disabled:cursor-not-allowed"
      />
      {/* Placed at their value on the track, two presets a few threads apart printed over each other. */}
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${presets.length}, minmax(0, 1fr))` }}
      >
        {presets.map(({ names, threads: t }) => (
          <button
            key={names}
            type="button"
            data-slot="power-preset"
            data-on={t === value ? '' : undefined}
            aria-pressed={t === value}
            disabled={disabled}
            onClick={() => onChange(t)}
            className={cn(
              'h-[26px] rounded-[5px] border border-line font-mono text-[11px] font-medium text-ink-2 outline-none hover:border-line-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none',
              t === value && 'border-uv/60 bg-uv-dim text-uv-2 hover:border-uv/60 hover:text-uv-2',
            )}
          >
            {names}
          </button>
        ))}
      </div>
    </div>
  );
}
