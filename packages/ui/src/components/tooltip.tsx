import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/**
 * A dotted word that explains itself on hover or focus. Each `Tip` carries its own provider, so it
 * works in a second React root (the pop-out) and in a spec without setup; nested providers are fine.
 * Invisible on touch: what a touch user needs goes in a popover, not here.
 */
export function Tip({
  tip,
  side = 'top',
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & {
  tip: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger
          type="button"
          data-slot="tip-trigger"
          className={cn(
            'inline cursor-help rounded-xs bg-transparent p-0 text-left underline decoration-ink-4 decoration-dotted underline-offset-[3px] outline-none [color:inherit] [font:inherit] focus-visible:ring-2 focus-visible:ring-ring/50',
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={side}
            sideOffset={6}
            collisionPadding={8}
            data-slot="tip"
            className="z-50 max-w-[280px] rounded-md border border-line-2 bg-raised px-3 py-2 text-xs leading-[1.45] text-ink shadow-lg [text-wrap:pretty] motion-safe:data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0"
          >
            {tip}
            <TooltipPrimitive.Arrow className="fill-line-2" width={10} height={5} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
