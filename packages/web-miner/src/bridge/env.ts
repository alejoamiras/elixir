// The two bridge blocks the build carries, parsed once per read: nothing else in the page decides
// whether the bridge exists. Kept free of the wallet stack so a tile can ask without loading it.
import type { BridgeRecord, MigrationRecord } from '../../../bridge/src/record.ts';

/** The build's portal, or null before the L1 deploy: no bridge features then. */
export const bridgeRecord = (): BridgeRecord | null =>
  import.meta.env.VITE_BRIDGE ? (JSON.parse(import.meta.env.VITE_BRIDGE) as BridgeRecord) : null;

/** The announced upgrade, or null on a quiet version. */
export const migrationRecord = (): MigrationRecord | null =>
  import.meta.env.VITE_MIGRATION ? (JSON.parse(import.meta.env.VITE_MIGRATION) as MigrationRecord) : null;

/** The versioned origin's build: it restores accounts and moves what is left, and mines nothing. */
export const isOldRole = (): boolean => import.meta.env.VITE_APP_ROLE === 'old';

export interface ServedBuild {
  miner?: string;
  rollupVersion?: string;
}

/** The deployment the site serves now, from its `/build.json`; null when unreadable. */
export async function servedBuild(): Promise<ServedBuild | null> {
  const url = `${(import.meta.env.BASE_URL ?? '/').replace(/\/mine\/?$/, '/')}build.json`;
  try {
    return (await (await fetch(url, { cache: 'no-store' })).json()) as ServedBuild;
  } catch {
    return null;
  }
}

/** Whether the served build is another deployment than this tab's; an unreadable file is not. */
export const staleTab = (
  served: ServedBuild | null,
  mine: { miner: string; rollupVersion: string },
): boolean =>
  !!served?.miner &&
  !!served.rollupVersion &&
  (served.miner.toLowerCase() !== mine.miner.toLowerCase() || served.rollupVersion !== mine.rollupVersion);
