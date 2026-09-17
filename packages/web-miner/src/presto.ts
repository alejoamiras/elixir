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

const ROUTES = ['/health', '/prove', '/prove/ultra-honk'];

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

/** Presto's site: the billboard's link and the epoch tile's "About Presto". */
export const PRESTO_SITE = 'https://presto.build';

/**
 * Native is the prover in force: the Worker built Presto's and has not given up on it. The epoch
 * tile's row ↔ slider swap and the thread rule follow this; `active` flips on one refused proof and
 * only the pill's ✦ follows it.
 */
export const prestoSticky = (s: PrestoState): boolean => s.selected === 'presto' && !s.fallbackReason;

/** Native is worth asking for when Presto answers and serves UltraHonk; a pending bb download is not a bar. */
export const prestoEligible = (status: PrestoStatus | null): boolean =>
  status?.available === true && (status.schemes ?? []).includes('ultra_honk');

/**
 * The wallet's transaction proof goes to Presto: the page's probe saw it serve the kernel's scheme
 * and the Worker has not given up on it. The Worker's own build does not matter (it wants
 * UltraHonk); an unprobed Presto is not asked.
 */
export const prestoProvesTx = (s: PrestoState): boolean =>
  s.fallbackReason === undefined &&
  s.status?.available === true &&
  (s.status.schemes ?? []).includes('chonk');

/**
 * Who is proving the wallet's transaction, from the prover's phases: unknown until the steps are
 * transmitted (Presto) or proving begins without a transmit (the page); a fallback is the page's.
 */
export const txProvingAfter = (prev: ProverKind | null, phase: PrestoPhase): ProverKind | null => {
  switch (phase) {
    case 'detect':
      return null;
    case 'transmit':
      return 'presto';
    case 'proving':
      return prev ?? 'wasm';
    case 'fallback':
      return 'wasm';
    default:
      return prev;
  }
};

/** The prover of the transaction under way; null between proofs. */
export const txProvingAtom = atom<ProverKind | null>(null);

/** What a proving step says, by who proves it; the times are this machine's: Presto's own bb, or bb.js in the page. */
export const PROVING = {
  presto: {
    about: 'about 5 s',
    line: 'proves through Presto ✦, about 5 s · mining pauses meanwhile',
    detail: 'Through Presto ✦ on this machine; mining pauses meanwhile.',
    foot: 'Keep this tab open while it proves, about 5 s.',
    claim: 'claiming: proving through Presto ✦',
    how: 'With Presto, your transaction’s private inputs go to Presto on this machine, never elsewhere; mining pauses meanwhile.',
  },
  wasm: {
    about: 'about 20 s',
    line: 'proves in your browser, about 20 s · mining pauses meanwhile',
    detail: 'In your browser; mining pauses meanwhile.',
    foot: 'Keep this tab open while it proves, about 20 s.',
    claim: 'claiming: proving in your browser, about 20 s',
    how: 'Your browser proves it; mining pauses meanwhile.',
  },
} as const satisfies Record<ProverKind, Record<string, string>>;

/**
 * The guard's deadline on Presto's routes, in the Worker and the page alike: a proof may wait behind
 * Presto's queue and, once, behind its bb download; the SDK bounds the health check itself.
 */
export const ACCELERATOR_DEADLINE_MS = 600_000;

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
  setAcceleratorEndpoints(acceleratorUrls(endpoint), ACCELERATOR_DEADLINE_MS);
  const status = await clientFor(endpoint).checkStatus({ forceRefresh: force });
  store.set(prestoAtom, (s) => ({ ...s, status, probedAt: Date.now() }));
  return status;
}

/**
 * What the page is told about a native proof's phases: the start of a bb download, and the end of the
 * proving that follows it. The SDK walks serialize → transmit → proving between the two, so only a
 * finished or abandoned proof ends the download; every other phase is the page's business to ignore.
 */
export function downloadPhases(post: (phase: PrestoPhase) => void): (phase: PrestoPhase) => void {
  let downloading = false;
  return (phase) => {
    if (phase === 'downloading') {
      if (downloading) return;
      downloading = true;
    } else if (!downloading || (phase !== 'proved' && phase !== 'fallback')) return;
    else downloading = false;
    post(phase);
  };
}

export interface PrestoNotice {
  tone: 'warn' | 'info';
  text: string;
  retry: boolean;
}

const UPDATE =
  'Presto needs an update for this app. Open Presto from your menu bar and let it update, then retry.';
const ENCRYPTED =
  'Presto’s encrypted connection is off. Presto › Settings › Encrypted Connection, then retry.';
const GONE = 'Presto stopped answering. Proving in the browser; retry when it’s back.';

/** The Worker's sticky reasons, in the visitor's terms; the site is named so the approval step is unmistakable. */
const causeText = (cause: FallbackCause, site: string): string => {
  switch (cause) {
    case 'denied':
      return `Presto hasn’t approved ${site} yet. Approve it in the Presto app, then retry. Proving in the browser meanwhile.`;
    case 'cooldown':
      return `Presto is in a cooldown after a denial. Approve ${site} in the app; Retry works once the cooldown ends, about a minute.`;
    case 'transient':
      return 'Presto is busy: three proofs in a row refused. Proving in the browser; Retry tries it again.';
    case 'invalid-proof':
      return 'Presto returned a winning proof that didn’t verify. Proving in the browser; check the Presto install, then retry.';
    case 'malformed-response':
      return 'Presto answered with something this page couldn’t use. Proving in the browser; Retry tries it again.';
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
      return 'Your browser blocked local access, so this page can’t reach Presto. Allow local network access for this site, then retry. Mining in the browser meanwhile.';
    case 'secure-connection-unavailable':
      return status.diagnosis === 'unconfirmed' ? null : ENCRYPTED;
    case 'version-mismatch':
      return UPDATE;
    case 'error':
      return 'Presto answered, but not with a health report this page understands. Proving in the browser; Retry asks again.';
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
      text: `Presto is fetching its prover for Aztec ${PRESTO_AZTEC_VERSION}. The first native proof waits for it; the rate stalls until then.`,
      retry: false,
    };
  if (!s.status) return null;
  const text = statusText(s.status);
  return text ? { tone: 'warn', text, retry: true } : null;
}
