import { Switch as SwitchPrimitive } from 'radix-ui';
import type * as React from 'react';
import { cn } from '../lib/cn.ts';

function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        'inline-flex h-5 w-9 shrink-0 items-center rounded-full border border-line-2 bg-panel-2 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 data-[state=checked]:border-uv data-[state=checked]:bg-uv',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="block size-4 translate-x-0.5 rounded-full bg-ink transition-transform data-[state=checked]:translate-x-[18px] data-[state=checked]:bg-uv-ink"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
