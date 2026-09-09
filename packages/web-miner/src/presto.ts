// Presto, the native prover on the visitor's machine: where it listens, the exact URLs the page
// may reach it at, and what the page knows about it (the probe's answer, the Worker's choice).
import type { FallbackReason, PrestoConfig, PrestoPhase, PrestoStatus } from '@alejoamiras/presto-core';
import { atom } from 'jotai';

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
