import { Tooltip as TooltipPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/**
 * A dotted word explained on hover or focus; hoverable (WCAG 1.4.13), invisible on touch. Each `Tip`
 * carries its own provider (a second React root has none). In a second document (the pop-out) pass
 * `container`: radix portals to, and listens for the pointer's travel and release on, the opener's
 * `document` — so there the tip closes on the trigger's `pointerleave` and radix's pointer-down
 * bookkeeping is skipped, or one click would stop focus from opening it.
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
  const foreign = container != null;
  return (
    <TooltipPrimitive.Provider delayDuration={250} disableHoverableContent={foreign}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger
          type="button"
          data-slot="tip-trigger"
          onPointerDown={foreign ? (e) => e.preventDefault() : undefined}
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
