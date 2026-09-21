import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/**
 * A dotted word that explains itself on hover or focus. A second React root has no provider, so each
 * `Tip` carries its own; a second document (the pop-out) needs `container` too, since the portal
 * defaults to the opener's body. The content is never interactive, which keeps closing on the
 * trigger's own events rather than on listeners of the wrong document. Invisible on touch: what a
 * touch user needs goes in a popover, not here.
 */
export function Tip({
  tip,
  side = 'top',
  container,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<'button'>, 'children'> & {
  tip: React.ReactNode;
  side?: 'top' | 'bottom' | 'left' | 'right';
  /** Where the tip is portalled: the body of the document the trigger lives in, when that is not the page's. */
  container?: HTMLElement | null;
  children: React.ReactNode;
}) {
  return (
    <TooltipPrimitive.Provider delayDuration={250} disableHoverableContent>
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
        <TooltipPrimitive.Portal container={container}>
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
