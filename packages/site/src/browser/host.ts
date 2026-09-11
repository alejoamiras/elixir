// Where the page is served decides whether it may make keys. This gate steers honest bundles: the
// preview suffix trusts the account's matching workers.dev namespace, not the code's provenance.
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

/** The WebAuthn relying party for this host: the preview host itself, else the pinned production RP ID (eligibility is `keysAllowed`). */
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

export const keysAllowed = (hostname: string): boolean => {
  const kind = hostKind(hostname);
  if (kind === 'production' || kind === 'preview') return true;
  return kind === 'local' && import.meta.env.VITE_SITE_MODE !== 'production';
};
