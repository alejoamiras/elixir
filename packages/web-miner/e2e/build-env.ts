// The e2e build's environment, shared by the suite's setup and the upgrade rig's browser case: the
// throwaway deployment, the local node, localhost as the RP ID, query overrides on, the run's Presto
// port, and the bridge block when the run has a portal.
import type { BridgeRecord, Deployment, MigrationRecord } from '../../deploy/src/deploy.ts';

export interface BuildOptions {
  nodeUrl: string;
  prestoPort: number | null;
  bridge: BridgeRecord | null;
  /** The announced upgrade, when the build is to carry one. */
  migration?: MigrationRecord | null;
  /** A PXE that skips transaction proving (`E2E_PROVERLESS=1`). */
  proverless: boolean;
  /** `old` builds the versioned origin's app (restore only, no mining); `apex` when absent. */
  role?: 'apex' | 'old';
  /** The versioned origin the apex names, and the origin the old build is served from. */
  oldAppOrigin?: string;
  /** The WebAuthn relying party; `localhost` unless a case serves the apps under another name. */
  rpId?: string;
}

export const e2eBuildEnv = (d: Deployment, o: BuildOptions): NodeJS.ProcessEnv => ({
  ...process.env,
  // Vite keeps an inherited NODE_ENV (bun test sets `test`), which builds React's development
  // bundle — StrictMode rehearsals and all. The page under test is the production bundle.
  NODE_ENV: 'production',
  YACANA_SITE_MODE: 'e2e',
  YACANA_APP_ROLE: o.role ?? 'apex',
  ...(o.oldAppOrigin ? { VITE_OLD_APP_ORIGIN: o.oldAppOrigin } : {}),
  VITE_BRIDGE: o.bridge ? JSON.stringify(o.bridge) : '',
  VITE_MIGRATION: o.migration ? JSON.stringify(o.migration) : '',
  VITE_ETH_RPC_URL: o.bridge ? o.bridge.l1RpcUrl : '',
  VITE_PRESTO_E2E_PORT: o.prestoPort === null ? '' : String(o.prestoPort),
  VITE_AZTEC_NODE_URL: o.nodeUrl,
  VITE_RP_ID: o.rpId ?? 'localhost',
  VITE_E2E_QUERY_OVERRIDES: '1',
  VITE_E2E_PROVERLESS: o.proverless ? '1' : '',
  VITE_CHAIN_ID: d.chainId,
  VITE_ROLLUP_VERSION: d.rollupVersion,
  VITE_ROLLUP_ADDRESS: d.rollupAddress,
  VITE_YACANA_MINER: d.miner,
  VITE_YACANA_TOKEN: d.token,
  VITE_YACANA_MINER_CLASS: d.minerClassId,
  VITE_YACANA_TOKEN_CLASS: d.tokenClassId,
  // The config would otherwise read the profile record's continuation, not this deployment's.
  VITE_FIRST_EPOCH: d.continuation?.firstEpoch ?? '0',
});
