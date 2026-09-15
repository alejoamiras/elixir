import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/**
 * The amount being typed: the number, the unit and the MAX chip on one baseline, what sits under
 * it ("balance 3.5 tYACA") said once. Parsing and refusals belong to the form; the field only edits text.
 */
export function AmountField({
  id,
  value,
  onChange,
  unit,
  max,
  below,
  invalid,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  id: string;
  value: string;
  onChange: (text: string) => void;
  /** The ticker of the side the money is on: tYACA on Aztec, YACA on Ethereum. */
  unit: string;
  /** The ceiling MAX fills in, as text; nothing when unknown. */
  max?: string;
  below?: React.ReactNode;
  invalid?: boolean;
}) {
  return (
    <div data-slot="amount-field" className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        data-invalid={invalid || undefined}
        className={cn(
          'flex items-center gap-2.5 rounded-[8px] border border-line-2 bg-panel px-4 py-3.5 focus-within:border-uv',
          invalid && 'border-bad',
          disabled && 'opacity-70',
        )}
      >
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          className="min-w-0 flex-1 bg-transparent text-[34px] font-semibold leading-none tracking-[-0.03em] text-ink outline-none placeholder:font-medium placeholder:text-ink-4"
          {...props}
        />
        <span className="flex shrink-0 items-center gap-2.5">
          <span className="font-mono text-xs font-medium leading-none tracking-[0.04em] text-ink-3">
            {unit}
          </span>
          {max !== undefined && !disabled && (
            <button
              type="button"
              data-slot="max"
              onClick={() => onChange(max)}
              className="rounded-sm border border-uv/50 px-2 py-1 font-mono text-[11px] font-semibold leading-none tracking-[0.08em] text-uv-2 hover:bg-uv-dim"
            >
              MAX
            </button>
          )}
        </span>
      </label>
      {below !== undefined && <span className="font-mono text-2xs text-ink-3">{below}</span>}
    </div>
  );
}
