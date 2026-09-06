// The tab is a companion: title and favicon report while the page is hidden. Both are set from
// the store, so a background tab keeps reporting although nothing draws.
import { faviconDataUrl, type MarkState } from '../../ui/src/index.ts';

export interface TabStatus {
  mark: MarkState;
  /** e.g. "18/min"; omitted while idle. */
  rate?: string;
  /** e.g. "2/4"; omitted before the epoch is known. */
  claims?: string;
}

export const tabTitle = (s: TabStatus): string =>
  [
    s.mark === 'mining' || s.mark === 'won' ? '▸' : s.mark === 'paused' ? '‖' : null,
    s.rate,
    s.claims,
    'Yacana',
  ]
    .filter(Boolean)
    .join(' · ');

let icon: HTMLLinkElement | null = null;
let last: string | undefined;

export function applyTabStatus(s: TabStatus, doc: Document = document): void {
  doc.title = tabTitle(s);
  const href = faviconDataUrl(s.mark);
  if (href === last) return;
  last = href;
  icon ??=
    doc.querySelector<HTMLLinkElement>('link[rel="icon"]') ?? doc.head.appendChild(doc.createElement('link'));
  icon.rel = 'icon';
  icon.type = 'image/svg+xml';
  icon.href = href;
}
