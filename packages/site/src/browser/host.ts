// Where the page is served decides what it may do. Keys exist only on the production hostname:
// a preview (PR-controlled code under the project's own domain) or the pages.dev alias must not
// create or restore one.
export type HostKind = 'production' | 'alias' | 'preview' | 'local' | 'unknown';

export const hostKind = (hostname: string): HostKind => {
  if (hostname === import.meta.env.VITE_RP_ID) return 'production';
  if (hostname === 'yacana.pages.dev') return 'alias';
  if (hostname.endsWith('.yacana.pages.dev')) return 'preview';
  if (hostname === 'localhost') return 'local';
  return 'unknown';
};

/** The alias redirects to the real origin, path and query kept. */
export const aliasRedirect = (
  loc: Pick<Location, 'hostname' | 'pathname' | 'search' | 'hash'>,
): string | null =>
  hostKind(loc.hostname) === 'alias'
    ? `https://${import.meta.env.VITE_RP_ID}${loc.pathname}${loc.search}${loc.hash}`
    : null;

export const previewNotice = (hostname: string): string | null => {
  const kind = hostKind(hostname);
  return kind === 'preview' || kind === 'unknown'
    ? `Preview build: this is not ${import.meta.env.VITE_RP_ID}. Keys cannot be created or restored here.`
    : null;
};

/** Passkeys and words may be created or restored on the production host, or on localhost outside production builds. */
export const keysAllowed = (hostname: string): boolean => {
  const kind = hostKind(hostname);
  return kind === 'production' || (kind === 'local' && import.meta.env.VITE_SITE_MODE !== 'production');
};
