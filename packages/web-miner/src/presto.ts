// Presto, the native prover on the visitor's machine: where this build looks for it, the exact URLs
// the page may reach it at, the page's probe, and what the page knows about it (the probe's answer,
// the Worker's choice) with the words each state gets.
import {
  type FallbackReason,
  PrestoClient,
  type PrestoConfig,
  type PrestoPhase,
  type PrestoStatus,
} from '@alejoamiras/presto-core';
import { atom, type createStore } from 'jotai';
import { setAcceleratorEndpoints } from '../../site/src/browser/node-guard.ts';
import { queryOverridesAllowed } from './config';

type Store = ReturnType<typeof createStore>;

/** The SDK's connection config, every field spelled out so the guard can derive the URLs from it. */
export interface PrestoEndpoint {
  host: string;
  port: number;
  httpsPort: number;
  /** Never a witness over plaintext: the browser default, and the production value. */
  httpsOnly: boolean;
}

/** Presto's defaults; the desktop app serves HTTPS on 59834 once its certificate is trusted. */
export const PRESTO_DEFAULT: PrestoEndpoint = {
  host: '127.0.0.1',
  port: 59833,
  httpsPort: 59834,
  httpsOnly: true,
};

/** The Aztec release this miner proves with; Presto downloads that bb once if it lacks it. */
export const PRESTO_AZTEC_VERSION = '5.2.0';

export const prestoConfig = (e: PrestoEndpoint): PrestoConfig => ({
  host: e.host,
  port: e.port,
  httpsPort: e.httpsPort,
  httpsOnly: e.httpsOnly,
});

const ROUTES = ['/health', '/prove/ultra-honk'];

/**
 * The URLs the SDK fetches, exactly: health and prove over HTTPS, and over HTTP only when plaintext
 * is allowed (the e2e mode). Under `httpsOnly` the SDK's witness-free HTTP health diagnosis is not
 * admitted, so an installed Presto whose HTTPS is off reads as absent.
 */
export function acceleratorUrls(e: PrestoEndpoint): string[] {
  const urls = ROUTES.map((r) => `https://${e.host}:${e.httpsPort}${r}`);
  if (!e.httpsOnly) urls.push(...ROUTES.map((r) => `http://${e.host}:${e.port}${r}`));
  return urls;
}

/**
 * Where this build looks for Presto: the SDK's HTTPS defaults, or the e2e lane's plaintext port
 * (nothing listens for TLS there, so `httpsPort` is the same closed port). An e2e page on localhost
 * may move it (`?presto=<port>`) or switch it off (`?presto=off`: no probe, no banner, WASM).
 */
export function prestoEndpointFor(
  env: { e2ePort: string; overrides: boolean },
  query: URLSearchParams,
): PrestoEndpoint | null {
  const q = env.overrides ? query.get('presto') : null;
  if (q === 'off') return null;
  const port = q && /^\d+$/.test(q) ? Number(q) : env.e2ePort ? Number(env.e2ePort) : null;
  if (port !== null) return { host: '127.0.0.1', port, httpsPort: port, httpsOnly: false };
  return PRESTO_DEFAULT;
}

export const prestoEndpoint = (): PrestoEndpoint | null =>
  prestoEndpointFor(
    { e2ePort: import.meta.env.VITE_PRESTO_E2E_PORT ?? '', overrides: queryOverridesAllowed() },
    new URLSearchParams(globalThis.location?.search ?? ''),
  );

export type ProverKind = 'presto' | 'wasm';
/** Why the Worker stopped proving natively: the SDK's reason, or a native proof that did not verify. */
export type FallbackCause = FallbackReason | 'invalid-proof';

export interface PrestoState {
  /** The page's own probe; null before the first answer. */
  status: PrestoStatus | null;
  probedAt: number | null;
  /** The backend the Worker built (`ready`); 'presto' says nothing about native proving yet. */
  selected: ProverKind | null;
  /** What actually proved the last proof, from the Worker's `prover` messages. */
  active: ProverKind | null;
  /** Set once the Worker's choice of WASM is sticky; cleared by a rebuild, never by a probe. */
  fallbackReason?: FallbackCause;
  /** The backend's phase worth showing (`downloading`: Presto is fetching bb before the first proof). */
  phase?: PrestoPhase;
}

export const initialPresto: PrestoState = { status: null, probedAt: null, selected: null, active: null };
export const prestoAtom = atom<PrestoState>(initialPresto);

/** Native is worth asking for when Presto answers and serves UltraHonk; a pending bb download is not a bar. */
export const prestoEligible = (status: PrestoStatus | null): boolean =>
  status?.available === true && (status.schemes ?? []).includes('ultra_honk');

/** A probe waits at most this long at the guard; the SDK's own timeouts are shorter. */
const PROBE_DEADLINE_MS = 60_000;

const clients = new Map<string, PrestoClient>();
const clientFor = (e: PrestoEndpoint): PrestoClient => {
  const key = JSON.stringify(e);
  let c = clients.get(key);
  if (!c) {
    c = new PrestoClient({ presto: prestoConfig(e), aztecVersion: PRESTO_AZTEC_VERSION });
    clients.set(key, c);
  }
  return c;
};

/**
 * The page's probe: the guard of this realm learns Presto's URLs, the SDK asks `/health` (10 s
 * cache unless forced), the answer lands in the atom. Never awaited by the boot or the sign-in.
 */
export async function probePresto(
  store: Store,
  endpoint: PrestoEndpoint,
  force = false,
): Promise<PrestoStatus> {
  setAcceleratorEndpoints(acceleratorUrls(endpoint), PROBE_DEADLINE_MS);
  const status = await clientFor(endpoint).checkStatus({ forceRefresh: force });
  store.set(prestoAtom, (s) => ({ ...s, status, probedAt: Date.now() }));
  return status;
}

export interface PrestoNotice {
  tone: 'warn' | 'info';
  text: string;
  retry: boolean;
}

const UPDATE =
  'Presto needs an update for this app. Open Presto from your menu bar and let it update, then retry.';
const ENCRYPTED =
  'Presto is installed, but its encrypted connection isn’t on. Presto → Settings → Encrypted Connection, then retry.';
const GONE = 'Presto stopped answering. Proving in the browser; retry when it is back.';

/** The Worker's sticky reasons, in the visitor's terms; the site is named so the approval step is unmistakable. */
const causeText = (cause: FallbackCause, site: string): string => {
  switch (cause) {
    case 'denied':
      return `Presto has not approved ${site} yet. Approve it in the Presto app, then retry — proving in the browser meanwhile.`;
    case 'cooldown':
      return `Presto is still in a cooldown after a denial. Approve ${site} in the app, then retry.`;
    case 'transient':
      return 'Presto is busy (three proofs in a row refused). Proving in the browser; Retry tries native again.';
    case 'invalid-proof':
      return 'Presto returned a winning proof that did not verify. Proving in the browser; check the Presto install.';
    case 'malformed-response':
      return 'Presto answered with something this page could not use. Proving in the browser.';
    case 'version-mismatch':
    case 'scheme-unsupported':
    case 'route-missing':
      return UPDATE;
    case 'secure-connection-unavailable':
      return ENCRYPTED;
    default:
      return GONE;
  }
};

/** What the probe alone says needs fixing; null for "absent" (the billboard's case) and for "fine". */
const statusText = (status: PrestoStatus): string | null => {
  if (status.available) return prestoEligible(status) ? null : UPDATE;
  switch (status.reason) {
    case 'permission-blocked':
      return 'Your browser blocked local access. Allow local network access for this site, then retry.';
    case 'secure-connection-unavailable':
      return status.diagnosis === 'unconfirmed' ? null : ENCRYPTED;
    case 'version-mismatch':
      return UPDATE;
    case 'error':
      return 'Presto answered, but not with a health report this page understands. Proving in the browser.';
    default:
      return null;
  }
};

/** The fix-it row's content: the Worker's verdict first, then a download in progress, then the probe's. */
export function noticeFor(
  s: PrestoState,
  site = globalThis.location?.hostname ?? 'this site',
): PrestoNotice | null {
  if (s.fallbackReason) return { tone: 'warn', text: causeText(s.fallbackReason, site), retry: true };
  if (s.phase === 'downloading')
    return {
      tone: 'info',
      text: `Presto is fetching bb for Aztec ${PRESTO_AZTEC_VERSION} — the first native proof takes longer.`,
      retry: false,
    };
  if (!s.status) return null;
  const text = statusText(s.status);
  return text ? { tone: 'warn', text, retry: true } : null;
}
