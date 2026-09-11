// Where the page is served decides what it may do. Keys exist on the production hostname and on this
// project's own Workers previews (`<label>` + the committed suffix: version ids and branch aliases),
// where the relying party is the exact preview host. The rule steers an honest bundle; code that
// controls the page can drop it, so it must never be read as authenticating the code.
export type HostKind = 'production' | 'preview' | 'local' | 'unknown';

const LABEL = /^[a-z0-9-]+$/;

const isPreview = (hostname: string): boolean => {
  const suffix = import.meta.env.VITE_PREVIEW_HOST_SUFFIX;
  if (!suffix || !hostname.endsWith(suffix)) return false;
  return LABEL.test(hostname.slice(0, -suffix.length));
};

export const hostKind = (hostname: string): HostKind => {
  if (hostname === import.meta.env.VITE_RP_ID) return 'production';
  if (isPreview(hostname)) return 'preview';
  if (hostname === 'localhost') return 'local';
  return 'unknown';
};

/** The WebAuthn relying party this host may use: the pinned production RP ID, or the preview host itself. */
export const relyingParty = (hostname: string): string =>
  hostKind(hostname) === 'preview' ? hostname : import.meta.env.VITE_RP_ID;

/** Twelve words are the same account on every host, so the preview banner warns against carrying them over. */
export const previewNotice = (hostname: string): string | null => {
  switch (hostKind(hostname)) {
    case 'preview':
      return `Preview on ${hostname}. Use a new account for testing; never reuse twelve words between this preview and ${import.meta.env.VITE_RP_ID}.`;
    case 'unknown':
      return `This is not ${import.meta.env.VITE_RP_ID}. Accounts cannot be created or restored here.`;
    default:
      return null;
  }
};

/** Passkeys and words may be created or restored in production, on a preview, or on localhost outside production builds. */
export const keysAllowed = (hostname: string): boolean => {
  const kind = hostKind(hostname);
  if (kind === 'production' || kind === 'preview') return true;
  return kind === 'local' && import.meta.env.VITE_SITE_MODE !== 'production';
};
