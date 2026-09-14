// The sheet's figure as the field it edits: the big mono input, its unit, and "max" when a
// ceiling is known. Same shape as the settled amount block, so the review and the sent states
// read as the same figure, no longer editable.
import type * as React from 'react';
import { cn, MaxChip } from '../../../ui/src/index.ts';

export function AmountInput({
  id,
  value,
  onChange,
  unit,
  max,
  aside,
  disabled,
  className,
  ...props
}: Omit<React.ComponentProps<'input'>, 'value' | 'onChange'> & {
  id: string;
  value: string;
  onChange: (text: string) => void;
  unit: string;
  /** The ceiling "max" fills in, as text; nothing when unknown. */
  max?: string;
  /** What sits on the right instead of, or beside, the max chip. */
  aside?: React.ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      data-slot="amount"
      data-tone="strong"
      className={cn(
        'flex items-center justify-between gap-3 rounded-[8px] border border-line-2 px-4 py-3.5 focus-within:border-uv',
        className,
      )}
    >
      <span className="flex min-w-0 items-baseline gap-2">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode="decimal"
          placeholder="0.00"
          autoComplete="off"
          disabled={disabled}
          className="w-full min-w-0 bg-transparent font-mono text-[36px] font-semibold leading-none tracking-[-0.02em] text-ink outline-none placeholder:text-ink-4"
          {...props}
        />
        <small className="shrink-0 font-mono text-[13px] text-ink-3">{unit}</small>
      </span>
      <span className="flex shrink-0 items-center gap-2 font-mono text-2xs text-ink-3">
        {aside}
        {max !== undefined && !disabled && <MaxChip onClick={() => onChange(max)} />}
      </span>
    </label>
  );
}
