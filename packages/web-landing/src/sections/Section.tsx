import type { ComponentProps } from 'react';
import { cn } from '../../../ui/src/index.ts';
import type { SectionId } from '../copy';

/** One frame of the page: the id is the anchor and the test id; the frame owns its padding and grid. */
export function Section({
  id,
  className,
  ...props
}: Omit<ComponentProps<'section'>, 'id'> & { id: SectionId }) {
  return (
    <section
      id={id}
      data-testid={id}
      className={cn('scroll-mt-[52px] border-t border-line', className)}
      {...props}
    />
  );
}

/** The frame's mono label; an `h2` where the label is the frame's only heading. */
export function SectionLabel({
  as: Tag = 'p',
  className,
  ...props
}: ComponentProps<'p'> & { as?: 'p' | 'h2' }) {
  return <Tag className={cn('label-mono', className)} {...props} />;
}

export function SectionHeading({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      className={cn('mt-2.5 mb-3.5 text-balance text-2xl font-semibold tracking-[-0.03em]', className)}
      {...props}
    />
  );
}
