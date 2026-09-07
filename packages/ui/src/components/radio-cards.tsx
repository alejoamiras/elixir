import { RadioGroup } from 'radix-ui';
import { cn } from '../lib/cn.ts';

export interface RadioCardOption<T extends string> {
  value: T;
  label: string;
  /** What choosing it means, stated where the choice is made. */
  description: string;
}

/** One choice among a few, each card stating its consequence; full width, the chosen card outlined. */
export function RadioCards<T extends string>({
  value,
  onChange,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly RadioCardOption<T>[];
  className?: string;
  'aria-label': string;
}) {
  return (
    <RadioGroup.Root
      value={value}
      onValueChange={(v) => onChange(v as T)}
      aria-label={ariaLabel}
      data-slot="radio-cards"
      className={cn('flex flex-col gap-2', className)}
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          data-slot="radio-card"
          className="flex w-full items-start gap-3 rounded-[8px] border border-line-2 px-3.5 py-3 text-left outline-none transition-colors hover:border-ink-3 focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=checked]:border-uv data-[state=checked]:bg-uv-dim"
        >
          <span
            aria-hidden
            className="mt-[3px] flex size-4 shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink-3 group-data-[state=checked]:border-uv"
          >
            <RadioGroup.Indicator className="block size-2 rounded-full bg-uv" />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm font-semibold">{o.label}</span>
            <span className="text-xs text-ink-2">{o.description}</span>
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
