import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-2xs whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'border-line bg-panel text-ink-2',
        uv: 'border-uv/45 bg-uv-dim text-uv-2',
        ok: 'border-ok/35 bg-transparent text-ok',
        warn: 'border-warn/45 bg-transparent text-warn uppercase tracking-[0.1em] font-medium',
        bad: 'border-bad/50 bg-transparent text-bad',
      },
    },
    defaultVariants: { variant: 'neutral' },
  },
);

function Badge({
  className,
  variant = 'neutral',
  ...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
