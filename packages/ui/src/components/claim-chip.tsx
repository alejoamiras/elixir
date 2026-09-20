import type * as React from 'react';
import { StatusChip } from './status-chip.tsx';

export type ClaimStep = 'proving' | 'sent' | 'in a block';

/** The claim's step and one clock, counted from the win across the steps; Stop pressed turns it into the wait. */
export function ClaimChip({
  step,
  seconds,
  stopping = false,
  ...props
}: Omit<React.ComponentProps<'span'>, 'children'> & {
  step: ClaimStep;
  seconds: number;
  stopping?: boolean;
}) {
  const s = Math.max(0, Math.floor(seconds));
  return (
    <StatusChip tone="on" data-slot="claim-chip" data-step={stopping ? 'finishing' : step} {...props}>
      {stopping ? `stopping · claim finishing · ${s} s` : `claiming · ${step} · ${s} s`}
    </StatusChip>
  );
}
