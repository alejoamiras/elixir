import { ExternalLink } from './external-link.tsx';
import { shortHash } from './marks.tsx';

/** A chip whose value opens the explorer's page for it, a copy button beside it; plain text without `href`. */
export function ChipLink({
  label,
  value,
  href,
  short = shortHash,
  testId,
}: {
  label: string;
  value: string;
  href?: string;
  short?: (v: string) => string;
  testId?: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-sm border border-line bg-panel px-2 py-1 font-mono text-2xs text-ink-2">
      <span>{label}</span>
      <ExternalLink href={href} full={value} copy className="text-ink" data-testid={testId}>
        {short(value)}
      </ExternalLink>
    </span>
  );
}
