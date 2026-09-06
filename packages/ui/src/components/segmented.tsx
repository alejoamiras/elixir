import { ToggleGroup } from 'radix-ui';
import { cn } from '../lib/cn.ts';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  'aria-label': ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  className?: string;
  'aria-label': string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={ariaLabel}
      data-slot="segmented"
      className={cn('inline-flex overflow-hidden rounded-md border border-line-2 text-sm', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          data-slot="segment"
          className="px-3.5 py-1.5 text-ink-2 transition-colors outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=on]:bg-ink data-[state=on]:font-semibold data-[state=on]:text-ground"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
