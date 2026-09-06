import type { ReactNode } from 'react';
import type { SectionId } from '../copy';

/** One screen, one sentence: the eyebrow names it, the heading is the argument, the body the evidence. */
export function Section({
  id,
  eyebrow,
  heading,
  children,
}: {
  id: SectionId;
  eyebrow: string;
  heading: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex scroll-mt-16 flex-col gap-6 border-t border-line py-14 md:py-20"
      data-testid={id}
    >
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="max-w-3xl text-balance text-2xl font-semibold tracking-tight md:text-3xl">{heading}</h2>
      {children}
    </section>
  );
}
