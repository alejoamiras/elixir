import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md border font-sans font-semibold whitespace-nowrap transition-colors duration-200 outline-none select-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        outline: 'border-line-2 bg-transparent text-ink hover:bg-panel',
        primary: 'border-ink bg-ink text-ground hover:bg-ink/90',
        uv: 'border-uv bg-uv text-uv-ink hover:bg-uv-2',
        ghost: 'border-transparent text-ink-2 hover:bg-panel hover:text-ink',
        danger: 'border-bad/50 bg-transparent text-bad hover:bg-bad/10',
        link: 'h-auto border-transparent px-0 font-normal text-ink-2 underline underline-offset-3 hover:text-ink',
      },
      size: {
        default: 'h-[38px] px-4 text-sm',
        sm: 'h-[30px] px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'size-[38px]',
      },
    },
    defaultVariants: { variant: 'outline', size: 'default' },
  },
);

function Button({
  className,
  variant = 'outline',
  size = 'default',
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}

export { Button, buttonVariants };
