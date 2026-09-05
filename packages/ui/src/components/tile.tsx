import type * as React from 'react';
import { cn } from '../lib/cn.ts';

/** The panel every surface is built from: raised ground, hairline border, a mono label on top. */
function Tile({ className, flat, ...props }: React.ComponentProps<'section'> & { flat?: boolean }) {
  return (
    <section
      data-slot="tile"
      className={cn(
        'min-w-0 rounded-lg border border-line p-4',
        flat ? 'bg-transparent' : 'bg-raised',
        className,
      )}
      {...props}
    />
  );
}

function TileHeader({
  className,
  children,
  aside,
  ...props
}: React.ComponentProps<'h2'> & { aside?: React.ReactNode }) {
  return (
    <h2
      data-slot="tile-header"
      className={cn('label-mono mb-3 flex items-baseline justify-between gap-3 text-2xs', className)}
      {...props}
    >
      <span>{children}</span>
      {aside && (
        <span className="ml-auto text-right font-normal tracking-[0.04em] text-ink-4 normal-case">
          {aside}
        </span>
      )}
    </h2>
  );
}

/** A label/value row inside a tile. */
function KvRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-slot="kv"
      className={cn(
        'flex justify-between gap-3 border-t border-line py-1.5 text-sm first:border-t-0 [&>:first-child]:text-ink-2 [&>:last-child]:font-mono [&>:last-child]:text-xs',
        className,
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export { KvRow, Tile, TileHeader };
