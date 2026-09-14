// The two blocks a deployment record carries for the bridge, as every side reads them: the deploy
// script writes them, the site builds them into the apps, the operator and the stats page read them.
export interface BridgeRecord {
  chainId: string;
  portal: string;
  yaca: string;
  registry: string;
  operators: string;
  l1RpcUrl: string;
  /** The L1 block the portal was deployed by: where a search of its logs starts. */
  deployBlock?: string;
  /** The version's Registry index once the portal registered it: what names the version (V5, V6) on every page. */
  registryIndex?: string;
}

/**
 * The announced upgrade: written into the record when Aztec announces the version after this one
 * (the Registry index it will take, when it was announced, when the flip is expected), and carried
 * by the next site deploy — announcing is a redeploy.
 */
export interface MigrationRecord {
  toIndex: string;
  announcedAt: string;
  expectedFlipAt: string;
}
