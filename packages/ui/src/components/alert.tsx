import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/** The binder's banner: a tinted border in the semantic colour, never a filled block. */
const alertVariants = cva('grid w-full gap-0.5 rounded-md border px-3 py-2.5 text-left text-xs', {
  variants: {
    variant: {
      neutral: 'border-line-2 bg-raised text-ink-2',
      uv: 'border-uv/50 bg-uv-dim text-uv-2',
      warn: 'border-warn/45 bg-warn/8 text-warn',
      bad: 'border-bad/50 bg-bad/8 text-bad',
    },
  },
  defaultVariants: { variant: 'neutral' },
});

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof alertVariants>) {
  return (
    <div
      data-slot="alert"
      data-variant={variant ?? 'neutral'}
      role={variant === 'bad' ? 'alert' : 'status'}
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-title" className={cn('font-semibold', className)} {...props} />;
}

function AlertDescription({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="alert-description" className={cn('text-pretty', className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
