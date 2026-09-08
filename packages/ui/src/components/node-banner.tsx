import { Alert } from './alert.tsx';
import { NodeWayOut } from './node-way-out.tsx';

export type NodeBannerKind = 'throttled' | 'silent' | 'stale';

const clock = (s: number) => (s >= 90 ? `${Math.round(s / 60)} min` : `${s} s`);

const text = (kind: NodeBannerKind, ageS: number | null): string => {
  const age = ageS === null ? 'not read yet' : `${clock(ageS)} old and counting`;
  switch (kind) {
    case 'throttled':
      return `The node is rate-limiting this page (HTTP 429). The chain numbers are ${age}; a claim sent now would fail.`;
    case 'silent':
      return `The node has not answered for ${ageS === null ? 'a while' : clock(ageS)}. These are the last numbers read.`;
    case 'stale':
      return `The node answers, but no chain read has landed for ${ageS === null ? 'a while' : clock(ageS)}. These are the last numbers read.`;
  }
};

export interface NodeBannerState {
  kind: NodeBannerKind;
  /** Seconds the numbers have been old, or the node quiet; null before the first read. */
  ageS: number | null;
  /** Seconds until the next attempt, or null when none is scheduled. */
  retryInS: number | null;
}

/**
 * The node's trouble named under the header, where the preview notice lives: what is wrong, how
 * old the numbers are, the retry countdown, and the way out. Plain values in, so the design system
 * needs nothing from the site package; the apps derive them from the health store.
 */
export function NodeBanner({
  state,
  settingsHref,
  onDefault,
}: {
  state: NodeBannerState | null;
  settingsHref?: string;
  onDefault?: () => void;
}) {
  if (!state) return null;
  const { kind, ageS, retryInS } = state;
  return (
    <Alert variant="warn" data-testid="node-banner" data-kind={kind}>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span className="flex items-center gap-2.5">
          <i aria-hidden className="size-1.5 shrink-0 rounded-full bg-warn" />
          <span>{text(kind, ageS)}</span>
        </span>
        <span className="flex items-center gap-3.5 whitespace-nowrap">
          {retryInS !== null && (
            <span
              className="font-mono text-2xs tracking-[0.04em] text-warn/75"
              data-testid="node-banner-retry"
            >
              retrying in {Math.max(0, retryInS)} s
            </span>
          )}
          <NodeWayOut onDefault={onDefault} settingsHref={settingsHref} />
        </span>
      </div>
    </Alert>
  );
}
