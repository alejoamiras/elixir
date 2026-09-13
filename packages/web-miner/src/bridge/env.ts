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
